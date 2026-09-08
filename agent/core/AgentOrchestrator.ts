import type { AgentContext } from "../types.js";
import { Planner } from "./Planner.js";
import { ApprovalManager } from "../approvals/ApprovalManager.js";
import { PermissionEngine, type PermissionPolicy } from "./PermissionEngine.js";

export class AgentOrchestrator {
  readonly planner: Planner;
  readonly approvals: ApprovalManager;
  readonly permissions: PermissionEngine;

  constructor(policy: PermissionPolicy) {
    this.planner = new Planner();
    this.approvals = new ApprovalManager();
    this.permissions = new PermissionEngine(policy);
  }

  plan(context: AgentContext) {
    return this.planner.createPlan(context);
  }
}
