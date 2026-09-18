import { randomUUID } from "node:crypto";
import { hashToolCall } from "../security/ToolCallHash.js";
import type { ApprovalRecord } from "../approvals/ApprovalStore.js";

export interface ApprovalStoreWriter {
  put(input: Omit<ApprovalRecord, "createdAt" | "expiresAt" | "used">): Promise<ApprovalRecord>;
}

export interface CreatedApproval {
  approvalId: string;
  sessionId: string;
  actionId: string;
  toolName: string;
  argumentHash: string;
  expiresAt: number;
}

export async function createApproval(
  store: ApprovalStoreWriter,
  sessionId: string,
  actionId: string,
  toolName: string,
  input: unknown
): Promise<CreatedApproval> {
  const argumentHash = hashToolCall(toolName, input);
  const approvalId = randomUUID();
  const record = await store.put({ approvalId, sessionId, actionId, argumentHash });
  return {
    approvalId,
    sessionId,
    actionId,
    toolName,
    argumentHash,
    expiresAt: record.expiresAt
  };
}
