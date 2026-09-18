import OpenAI from "openai";
import type { AgentInput } from "../../app/AgentInput.js";
import { AgentError } from "../errors/AgentError.js";
import { CostBudget } from "../limits/CostBudget.js";
import { ProviderBudget } from "../limits/ProviderBudget.js";
import { estimateModelCost } from "./ModelPricing.js";
import { filterSensitiveContent } from "../privacy/ContentFilter.js";

export interface FunctionToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  risk: "green" | "yellow" | "red";
}

export interface ToolExecutionContext {
  name: string;
  argumentsJson: string;
  callId: string;
  requestId?: string;
}

export interface ToolExecutionResult {
  ok: boolean;
  output: unknown;
  approved: boolean;
  operationId?: string;
}

export interface PendingToolApproval {
  actionId: string;
  responseId: string;
  callId: string;
}

export interface ToolLoopResult {
  responseId: string;
  text: string;
  turns: number;
  toolCalls: number;
  pendingApproval?: PendingToolApproval;
}

export interface ToolExecutor {
  execute(context: ToolExecutionContext): Promise<ToolExecutionResult>;
}

export class OpenAIToolLoop {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly maxTurns: number;
  private readonly costBudget?: CostBudget;
  private readonly providerBudget?: ProviderBudget;

  constructor(options: { model?: string; maxTurns?: number; costBudget?: CostBudget; providerBudget?: ProviderBudget } = {}) {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.model = options.model ?? process.env.OPENAI_MODEL ?? "gpt-5.6-luna";
    this.maxTurns = options.maxTurns ?? 8;
    this.costBudget = options.costBudget;
    this.providerBudget = options.providerBudget;
  }

  async run(
    input: AgentInput,
    tools: FunctionToolSpec[],
    executor: ToolExecutor,
    instructions?: string,
    previousResponseId?: string,
    requestId?: string
  ): Promise<ToolLoopResult> {
    const response = await this.createResponse({
      model: this.model,
      ...(instructions ? { instructions } : {}),
      input: this.toResponsesInput(input),
      ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
      tools: this.toolDefinitions(tools)
    });
    return this.processResponse(response, tools, executor, 1, 0);
  }

  async resumeApprovedCall(
    responseId: string,
    callId: string,
    result: ToolExecutionResult,
    tools: FunctionToolSpec[],
    executor: ToolExecutor
  ): Promise<ToolLoopResult> {
    const response = await this.createResponse({
      model: this.model,
      previous_response_id: responseId,
      input: [{
        type: "function_call_output" as const,
        call_id: callId,
        output: JSON.stringify({ ok: result.ok, approved: result.approved, result: result.output })
      }],
      tools: this.toolDefinitions(tools)
    });
    return this.processResponse(response, tools, executor, 1, 1);
  }

  private async createResponse(request: Parameters<OpenAI["responses"]["create"]>[0]): Promise<OpenAI.Responses.Response> {
    this.providerBudget?.consume();
    let response: OpenAI.Responses.Response;
    try { response = await this.client.responses.create(request); }
    catch (error: unknown) { throw new AgentError("MODEL_FAILED", "Model request failed.", true, { cause: error }); }
    if (response.usage && this.costBudget) {
      const inputTokens = response.usage.input_tokens ?? 0;
      const outputTokens = response.usage.output_tokens ?? 0;
      try {
        this.costBudget.consume({ inputTokens, outputTokens, estimatedUsd: estimateModelCost(this.model, inputTokens, outputTokens) });
      } catch (error: unknown) { throw new AgentError("MODEL_FAILED", "Session model budget exceeded.", false, { cause: error }); }
    }
    return response;
  }

  private toResponsesInput(input: AgentInput) {
    if (typeof input === "string") {
      const filtered = filterSensitiveContent(input);
      if (filtered.blocked) throw new AgentError("MODEL_FAILED", "Sensitive content was blocked before model processing.", false);
      return filtered.value;
    }
    return [{ role: "user" as const, content: input.map(part => part.type === "input_text" ? { ...part, text: filterSensitiveContent(part.text).value } : part) }];
  }

  private async processResponse(
    initialResponse: OpenAI.Responses.Response,
    tools: FunctionToolSpec[],
    executor: ToolExecutor,
    initialTurn: number,
    initialToolCalls: number
  ): Promise<ToolLoopResult> {
    let response = initialResponse;
    let toolCalls = initialToolCalls;

    for (let turn = initialTurn; turn <= this.maxTurns; turn += 1) {
      const calls = response.output.filter((item) => item.type === "function_call");
      if (calls.length === 0) {
        return { responseId: response.id, text: response.output_text, turns: turn, toolCalls };
      }

      const outputs: Array<{ type: "function_call_output"; call_id: string; output: string }> = [];
      for (const item of calls) {
        if (item.type !== "function_call") continue;
        toolCalls += 1;
        const result = await executor.execute({ name: item.name, argumentsJson: item.arguments, callId: item.call_id, requestId });
        if (!result.approved && this.isApprovalRequired(result.output)) {
          return {
            responseId: response.id,
            text: "Hyväksyntä tarvitaan ennen tämän toiminnon suorittamista.",
            turns: turn,
            toolCalls,
            pendingApproval: { actionId: String(result.output.actionId), responseId: response.id, callId: item.call_id }
          };
        }
        outputs.push({
          type: "function_call_output",
          call_id: item.call_id,
          output: JSON.stringify({ ok: result.ok, approved: result.approved, result: result.output })
        });
      }

      response = await this.client.responses.create({
        model: this.model,
        previous_response_id: response.id,
        input: outputs,
        tools: this.toolDefinitions(tools)
      });
    }
    throw new Error(`Tool loop exceeded maximum turns (${this.maxTurns})`);
  }

  private isApprovalRequired(output: unknown): output is { status: "approval_required"; actionId: string } {
    return typeof output === "object" && output !== null
      && (output as { status?: unknown }).status === "approval_required"
      && typeof (output as { actionId?: unknown }).actionId === "string";
  }

  private toolDefinitions(tools: FunctionToolSpec[]) {
    return tools.map(({ name, description, parameters }) => ({
      type: "function" as const, name, description, parameters, strict: true
    }));
  }
}
