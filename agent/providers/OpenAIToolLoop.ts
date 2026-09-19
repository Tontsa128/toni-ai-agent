import OpenAI from "openai";
import type { AgentInput } from "../../app/AgentInput.js";
import { AgentError } from "../errors/AgentError.js";
import { CostBudget } from "../limits/CostBudget.js";
import { ProviderBudget } from "../limits/ProviderBudget.js";
import { estimateModelCost } from "./ModelPricing.js";
import { filterSensitiveContent } from "../privacy/ContentFilter.js";
import { UNTRUSTED_CONTENT_INSTRUCTION, wrapUntrustedToolOutput } from "../security/UntrustedContentBoundary.js";

export interface FunctionToolSpec { name: string; description: string; parameters: Record<string, unknown>; risk: "green" | "yellow" | "red"; }
export interface ToolExecutionContext { name: string; argumentsJson: string; callId: string; requestId?: string; }
export interface ToolExecutionResult { ok: boolean; output: unknown; approved: boolean; operationId?: string; }
export interface PendingToolApproval { actionId: string; responseId: string; callId: string; }
export interface ToolLoopResult { responseId: string; text: string; turns: number; toolCalls: number; pendingApproval?: PendingToolApproval; }
export interface ToolExecutor { execute(context: ToolExecutionContext): Promise<ToolExecutionResult>; }

export class OpenAIToolLoop {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly maxTurns: number;
  private readonly providerTimeoutMs: number;
  private readonly costBudget: CostBudget | undefined;
  private readonly providerBudget: ProviderBudget | undefined;

  constructor(options: { model?: string; maxTurns?: number; providerTimeoutMs?: number; costBudget?: CostBudget; providerBudget?: ProviderBudget } = {}) {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.model = options.model ?? process.env.OPENAI_MODEL ?? "gpt-5.6-luna";
    this.maxTurns = options.maxTurns ?? 8;
    this.providerTimeoutMs = options.providerTimeoutMs ?? Number(process.env.TONI_PROVIDER_TIMEOUT_MS ?? 60_000);
    if (!Number.isInteger(this.providerTimeoutMs) || this.providerTimeoutMs < 1_000 || this.providerTimeoutMs > 300_000) {
      throw new Error("Invalid provider timeout.");
    }
    this.costBudget = options.costBudget;
    this.providerBudget = options.providerBudget;
  }

  async run(input: AgentInput, tools: FunctionToolSpec[], executor: ToolExecutor, instructions?: string, previousResponseId?: string, requestId?: string, cancellationSignal?: AbortSignal): Promise<ToolLoopResult> {
    const response = await this.createResponse({
      model: this.model,
      instructions: [UNTRUSTED_CONTENT_INSTRUCTION, instructions].filter(Boolean).join("\n"),
      input: this.toResponsesInput(input),
      ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
      tools: this.toolDefinitions(tools)
    });
    return this.processResponse(response, tools, executor, 1, 0, requestId);
  }

  async resumeApprovedCall(responseId: string, callId: string, result: ToolExecutionResult, tools: FunctionToolSpec[], executor: ToolExecutor, requestId?: string): Promise<ToolLoopResult> {
    const response = await this.createResponse({
      model: this.model,
      previous_response_id: responseId,
      instructions: UNTRUSTED_CONTENT_INSTRUCTION,
      input: [{ type: "function_call_output" as const, call_id: callId, output: JSON.stringify({ ok: result.ok, approved: result.approved, result: wrapUntrustedToolOutput(result.output) }) }],
      tools: this.toolDefinitions(tools)
    });
    return this.processResponse(response, tools, executor, 1, 1, requestId);
  }

  private async createResponse(request: OpenAI.Responses.ResponseCreateParamsNonStreaming & { signal?: AbortSignal }): Promise<OpenAI.Responses.Response> {
    this.providerBudget?.consume();
    const timeout = AbortSignal.timeout(this.providerTimeoutMs);\n    const signal = request.signal ? AbortSignal.any([timeout, request.signal]) : timeout;
    let response: OpenAI.Responses.Response;
    try {
      response = await this.client.responses.create(request, { signal });
    } catch (error: unknown) {
      const message = request.signal?.aborted ? "Model request cancelled." : timeout.aborted ? "Model request timed out." : "Model request failed.";
      throw new AgentError("MODEL_FAILED", message, !timeout.aborted && !request.signal?.aborted, { cause: error });
    }
    if (response.usage && this.costBudget) {
      const inputTokens = response.usage.input_tokens ?? 0;
      const outputTokens = response.usage.output_tokens ?? 0;
      try {
        this.costBudget.consume({ inputTokens, outputTokens, estimatedUsd: estimateModelCost(this.model, inputTokens, outputTokens) });
      } catch (error: unknown) {
        throw new AgentError("MODEL_FAILED", "Session model budget exceeded.", false, { cause: error });
      }
    }
    return response;
  }

  private toResponsesInput(input: AgentInput) {
    if (typeof input === "string") {
      const filtered = filterSensitiveContent(input);
      if (filtered.blocked) throw new AgentError("MODEL_FAILED", "Sensitive content was blocked before model processing.", false);
      return filtered.value;
    }
    return [{
      role: "user" as const,
      content: input.map(part => {
        if (part.type !== "input_text") return part;
        const filtered = filterSensitiveContent(part.text);
        if (filtered.blocked) throw new AgentError("MODEL_FAILED", "Sensitive content was blocked before model processing.", false);
        return { ...part, text: filtered.value };
      })
    }];
  }

  private async processResponse(initialResponse: OpenAI.Responses.Response, tools: FunctionToolSpec[], executor: ToolExecutor, initialTurn: number, initialToolCalls: number, requestId?: string): Promise<ToolLoopResult> {
    let response = initialResponse;
    let toolCalls = initialToolCalls;
    for (let turn = initialTurn; turn <= this.maxTurns; turn += 1) {
      const calls = response.output.filter((item) => item.type === "function_call");
      if (calls.length === 0) return { responseId: response.id, text: response.output_text, turns: turn, toolCalls };
      const outputs: Array<{ type: "function_call_output"; call_id: string; output: string }> = [];
      for (const item of calls) {
        if (item.type !== "function_call") continue;
        toolCalls += 1;
        const result = await executor.execute({ name: item.name, argumentsJson: item.arguments, callId: item.call_id, ...(requestId ? { requestId } : {}) });
        if (!result.approved && this.isApprovalRequired(result.output)) {
          return { responseId: response.id, text: "Hyväksyntä tarvitaan ennen tämän toiminnon suorittamista.", turns: turn, toolCalls, pendingApproval: { actionId: String(result.output.actionId), responseId: response.id, callId: item.call_id } };
        }
        outputs.push({ type: "function_call_output", call_id: item.call_id, output: JSON.stringify({ ok: result.ok, approved: result.approved, result: wrapUntrustedToolOutput(result.output) }) });
      }
      response = await this.createResponse({ model: this.model, previous_response_id: response.id, instructions: UNTRUSTED_CONTENT_INSTRUCTION, input: outputs, tools: this.toolDefinitions(tools) });
    }
    throw new AgentError("MODEL_FAILED", `Tool loop exceeded maximum turns (${this.maxTurns}).`, false);
  }

  private isApprovalRequired(output: unknown): output is { status: "approval_required"; actionId: string } {
    return typeof output === "object" && output !== null
      && (output as { status?: unknown }).status === "approval_required"
      && typeof (output as { actionId?: unknown }).actionId === "string";
  }

  private toolDefinitions(tools: FunctionToolSpec[]) {
    return tools.map(({ name, description, parameters }) => ({ type: "function" as const, name, description, parameters, strict: true }));
  }
}
