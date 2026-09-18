import { randomUUID } from "node:crypto";
import { hashToolCall } from "../security/ToolCallHash.js";
import type { ApprovalRecord } from "../approvals/ApprovalStore.js";

export interface ApprovalStoreWriter {
  put(input:{approvalId:string;userId:string;sessionId:string;actionId:string;toolName:string;argumentHash:string}):Promise<ApprovalRecord>;
}
export interface CreatedApproval { approvalId:string; sessionId:string; actionId:string; toolName:string; argumentHash:string; expiresAt:number; }
export async function createApproval(store:ApprovalStoreWriter,userId:string,sessionId:string,actionId:string,toolName:string,input:unknown):Promise<CreatedApproval>{
  const argumentHash=hashToolCall(toolName,input); const approvalId=randomUUID();
  const record=await store.put({approvalId,userId,sessionId,actionId,toolName,argumentHash});
  return {approvalId,sessionId,actionId,toolName,argumentHash,expiresAt:record.expiresAt};
}