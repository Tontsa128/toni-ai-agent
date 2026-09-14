import { randomUUID } from "node:crypto";
import type { AgentAction, AgentContext } from "../types.js";
import { Planner } from "./Planner.js";
import { ApprovalManager } from "../approvals/ApprovalManager.js";
import { PermissionEngine, type PermissionPolicy } from "./PermissionEngine.js";
import { ToolchainSupervisor } from "../supervisor/ToolchainSupervisor.js";
import type { ToolInvocation } from "../sandbox/types.js";

export interface PlannedAction extends AgentAction { status: "ready" | "approval_required"; }

export class AgentOrchestrator {
  readonly planner = new Planner();
  readonly approvals = new ApprovalManager();
  readonly permissions: PermissionEngine;
  readonly supervisor = new ToolchainSupervisor();

  constructor(policy: PermissionPolicy) { this.permissions = new PermissionEngine(policy); }
  plan(context: AgentContext) { return this.planner.createPlan(context); }

  authorize(context: AgentContext, invocation: ToolInvocation): PlannedAction {
    const supervised = this.supervisor.inspect(invocation);
    const action = this.permissions.evaluate(
      { ...supervised, id: randomUUID(), createdAt: new Date().toISOString() },
      context,
      invocation.input
    );
    const result: PlannedAction = { ...action, status: action.requiresApproval ? "approval_required" : "ready" };
    if (result.requiresApproval) this.approvals.request({ action: result, reason: `Approval required for ${result.risk}-risk operation.` });
    return result;
  }
}
