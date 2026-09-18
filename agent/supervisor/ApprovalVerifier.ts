import { hashToolCall } from "../security/ToolCallHash.js";
import type { ApprovalStore } from "../approvals/ApprovalStore.js";

export interface ApprovalVerificationInput {
  approvalId: string;
  sessionId: string;
  actionId: string;
  toolName: string;
  toolInput: unknown;
}

export class StoreApprovalVerifier {
  public constructor(private readonly store: ApprovalStore) {}

  public async verify(input: ApprovalVerificationInput): Promise<boolean> {
    const record = this.store.get(input.approvalId);
    if (!record) return false;

    const argumentHash = hashToolCall(input.toolName, input.toolInput);
    return (
      record.sessionId === input.sessionId &&
      record.actionId === input.actionId &&
      record.argumentHash === argumentHash &&
      record.expiresAt > Date.now() &&
      !record.used
    );
  }
}
