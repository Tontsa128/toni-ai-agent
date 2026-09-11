import type { AgentContext } from "../types.js";
import type { ToolExecutionContext, ToolExecutionResult } from "../providers/OpenAIToolLoop.js";
import { AgentOrchestrator } from "./AgentOrchestrator.js";

interface PendingCall {
  actionId: string;
  context: AgentContext;
  call: ToolExecutionContext;
}

/**
 * Keeps approval-required function calls resumable without persisting their arguments.
 * Pending calls live only in process memory so credentials cannot accidentally land in
 * a durable approval queue. The actual execution still goes through the orchestrator.
 */
export class ApprovalContinuation {
  private readonly pending = new Map<string, PendingCall>();

  constructor(private readonly orchestrator: AgentOrchestrator) {}

  hold(actionId: string, context: AgentContext, call: ToolExecutionContext): void {
    this.pending.set(actionId, { actionId, context, call });
  }

  async approveAndResume(actionId: string, execute: (call: ToolExecutionContext) => Promise<ToolExecutionResult>): Promise<ToolExecutionResult> {
    const pending = this.pending.get(actionId);
    if (!pending) throw new Error(`No pending tool call for approval action ${actionId}`);
    const approval = this.orchestrator.approvals.approve(actionId);
    if (approval.approved !== true) throw new Error("Approval was not granted");

    this.pending.delete(actionId);
    return await execute(pending.call);
  }

  reject(actionId: string): void {
    this.orchestrator.approvals.reject(actionId);
    this.pending.delete(actionId);
  }

  listActionIds(): string[] {
    return [...this.pending.keys()];
  }
}
