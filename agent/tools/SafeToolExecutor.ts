import { AgentError } from "../errors/AgentError.js";
import { hashToolCall } from "../security/ToolCallHash.js";
import { SessionBudget } from "../limits/SessionBudget.js";
import { ToolRegistry, type ToolExecutionContext } from "./ToolRegistry.js";

export interface SafeToolExecutionResult {
  toolName: string;
  argumentHash: string;
  output: unknown;
}

export class SafeToolExecutor {
  constructor(private readonly registry: ToolRegistry, private readonly budget: SessionBudget) {}

  async execute(toolName: string, rawInput: unknown, context: ToolExecutionContext): Promise<SafeToolExecutionResult> {
    this.budget.consumeToolCall();
    if (context.signal.aborted) throw new AgentError("CANCELLED", "Tool execution was cancelled.", false);
    const tool = this.registry.get(toolName);
    let input: unknown;
    try {
      input = tool.validateInput ? tool.validateInput(rawInput) : rawInput;
    } catch (error: unknown) {
      throw new AgentError("TOOL_INPUT_INVALID", error instanceof Error ? error.message : "Tool input validation failed.", false, { cause: error });
    }
    const argumentHash = hashToolCall(toolName, input);
    try {
      const output = await tool.execute(input, context);
      if (context.signal.aborted) throw new AgentError("CANCELLED", "Tool execution was cancelled.", false);
      return { toolName, argumentHash, output };
    } catch (error: unknown) {
      if (error instanceof AgentError) throw error;
      throw new AgentError("TOOL_FAILED", `Tool failed: ${toolName}`, true, { cause: error });
    }
  }
}
