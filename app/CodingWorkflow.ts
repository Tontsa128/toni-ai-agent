import type { PermissionPolicy } from "../agent/core/PermissionEngine.js";
import {
  CodingAgent,
  type CodingAgentOptions,
  type CodingAgentResult
} from "../agent/coding/CodingAgent.js";
import type { RepairSessionSnapshot } from "../agent/coding/RepairSession.js";

/**
 * Owns one CodingAgent instance for the lifetime of a workflow.
 *
 * InteractiveSession and other front ends can therefore address the same
 * resumable repair session instead of maintaining a second coordinator.
 */
export class CodingWorkflow {
  readonly agent: CodingAgent;

  constructor(
    workspace: string,
    policy: PermissionPolicy,
    options: CodingAgentOptions = {}
  ) {
    this.agent = new CodingAgent(workspace, policy, options);
  }

  async run(request: string): Promise<CodingAgentResult> {
    return this.agent.run(request);
  }

  async startRepair(): Promise<RepairSessionSnapshot> {
    return this.agent.startRepair();
  }

  async approveRepair(actionId: string): Promise<RepairSessionSnapshot> {
    return this.agent.approveRepair(actionId);
  }

  rejectRepair(actionId: string): RepairSessionSnapshot {
    return this.agent.rejectRepair(actionId);
  }

  getRepairSnapshot(): RepairSessionSnapshot {
    return this.agent.getRepairSnapshot();
  }
}
