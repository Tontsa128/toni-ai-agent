import type { AgentContext } from "../types.js";
import type { ToolInvocation } from "../sandbox/types.js";
import { ToolRegistry } from "../tools/ToolRegistry.js";
import { AgentOrchestrator } from "./AgentOrchestrator.js";

/**
 * Bridge between model-generated function calls and the local authorization boundary.
 * A yellow/red action is never executed here until a human approval is recorded.
 */
export class SupervisedToolExecutor {
  constructor(
    private readonly orchestrator: AgentOrchestrator,
    private readonly registry: ToolRegistry,
    private readonly context: AgentContext
  ) {}

  async execute(input: { name: string; argumentsJson: string; callId: string }): Promise<{ ok: boolean; output: unknown; approved: boolean }> {
    const tool = this.registry.get(input.name);
    let parsed: unknown;
    try {
      parsed = JSON.parse(input.argumentsJson);
    } catch {
      return { ok: false, approved: false, output: { error: "Tool arguments were not valid JSON" } };
    }

    const invocation: ToolInvocation = {
      tool: input.name,
      operation: "execute",
      input: parsed,
      risk: tool.risk
    };
    const action = this.orchestrator.authorize(this.context, invocation);
    if (action.requiresApproval) {
      return {
        ok: false,
        approved: false,
        output: {
          status: "approval_required",
          actionId: action.id,
          description: action.description,
          risk: action.risk
        }
      };
    }

    try {
      const output = await tool.execute(parsed);
      return { ok: true, approved: true, output };
    } catch (error) {
      return {
        ok: false,
        approved: true,
        output: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }
}
