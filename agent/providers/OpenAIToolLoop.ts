import OpenAI from "openai";

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
}

export interface ToolExecutionResult {
  ok: boolean;
  output: unknown;
  approved: boolean;
}

export interface ToolLoopResult {
  responseId: string;
  text: string;
  turns: number;
  toolCalls: number;
}

export interface ToolExecutor {
  execute(context: ToolExecutionContext): Promise<ToolExecutionResult>;
}

/**
 * Closed Responses-API tool loop. The model can propose functions, but the executor
 * is the only component allowed to run them. The executor must call the local
 * supervisor/permission engine before touching filesystem, browser, GitHub or OS state.
 */
export class OpenAIToolLoop {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly maxTurns: number;

  constructor(options: { model?: string; maxTurns?: number } = {}) {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.model = options.model ?? process.env.OPENAI_MODEL ?? "gpt-5.6-luna";
    this.maxTurns = options.maxTurns ?? 8;
  }

  async run(input: string, tools: FunctionToolSpec[], executor: ToolExecutor, instructions?: string): Promise<ToolLoopResult> {
    let response = await this.client.responses.create({
      model: this.model,
      ...(instructions ? { instructions } : {}),
      input,
      tools: tools.map(({ name, description, parameters }) => ({
        type: "function" as const,
        name,
        description,
        parameters,
        strict: true
      }))
    });

    let toolCalls = 0;
    for (let turn = 1; turn <= this.maxTurns; turn += 1) {
      const calls = response.output.filter((item) => item.type === "function_call");
      if (calls.length === 0) {
        return { responseId: response.id, text: response.output_text, turns: turn, toolCalls };
      }

      const outputs: Array<{ type: "function_call_output"; call_id: string; output: string }> = [];
      for (const item of calls) {
        if (item.type !== "function_call") continue;
        toolCalls += 1;
        const result = await executor.execute({ name: item.name, argumentsJson: item.arguments, callId: item.call_id });
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
        tools: tools.map(({ name, description, parameters }) => ({
          type: "function" as const,
          name,
          description,
          parameters,
          strict: true
        }))
      });
    }

    throw new Error(`Tool loop exceeded maximum turns (${this.maxTurns})`);
  }
}
