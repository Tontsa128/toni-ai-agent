import type { ApprovalRequest } from "../types.js";

export class ApprovalManager {
  private readonly pending = new Map<string, ApprovalRequest>();

  request(input: ApprovalRequest): ApprovalRequest {
    this.pending.set(input.action.id, input);
    return input;
  }

  approve(actionId: string): ApprovalRequest {
    const item = this.require(actionId);
    const result = { ...item, approved: true };
    this.pending.delete(actionId);
    return result;
  }

  reject(actionId: string): ApprovalRequest {
    const item = this.require(actionId);
    const result = { ...item, approved: false };
    this.pending.delete(actionId);
    return result;
  }

  list(): ApprovalRequest[] {
    return [...this.pending.values()];
  }

  private require(actionId: string): ApprovalRequest {
    const item = this.pending.get(actionId);
    if (!item) throw new Error(`Approval request not found: ${actionId}`);
    return item;
  }
}
