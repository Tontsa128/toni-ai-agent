import type { AgentContext } from "../types.js";
import type { ToolInvocation } from "../sandbox/types.js";
import { ToolRegistry } from "../tools/ToolRegistry.js";
import { AgentOrchestrator } from "./AgentOrchestrator.js";
import { ApprovalContinuation } from "./ApprovalContinuation.js";
import type { ToolExecutionContext, ToolExecutionResult } from "../providers/OpenAIToolLoop.js";

/**
 * Bridge between model-generated function calls and the local authorization boundary.
 * A yellow/red action is never executed here until a human approval is recorded.
 */
export class SupervisedToolExecutor {
  readonly continuations: ApprovalContinuation;

  constructor(
    private readonly orchestrator: AgentOrchestrator,
    private readonly registry: ToolRegistry,
    private readonly context: AgentContext
  ) {
    this.continuations = new ApprovalContinuation(orchestrator);
  }

  async execute(input: ToolExecutionContext): Promise<ToolExecutionResult> {
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
      this.continuations.hold(action.id, this.context, input);
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

    return this.executeRaw(input.name, parsed, true);
  }

  /** Resume the exact in-memory call after the corresponding approval is granted. */
  async approveAndResume(actionId: string): Promise<ToolExecutionResult> {
    return this.continuations.approveAndResume(actionId, async (call) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(call.argumentsJson);
      } catch {
        return { ok: false, approved: true, output: { error: "Tool arguments were not valid JSON" } };
      }
      return this.executeRaw(call.name, parsed, true);
    });
  }

  reject(actionId: string): void {
    this.continuations.reject(actionId);
  }

  private async executeRaw(name: string, input: unknown, approved: boolean): Promise<ToolExecutionResult> {
    const tool = this.registry.get(name);
    try {
      const output = await tool.execute(input);
      return { ok: true, approved, output };
    } catch (error) {
      return {
        ok: false,
        approved,
        output: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }
}
