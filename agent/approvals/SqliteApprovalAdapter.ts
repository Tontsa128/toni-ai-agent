import { ApprovalRepository } from "../../storage/repositories/ApprovalRepository.js";
import { hashToolCall } from "../security/ToolCallHash.js";

export class SqliteApprovalAdapter {
  public constructor(private readonly repository: ApprovalRepository) {}
  public create(input:{approvalId:string;userId:string;sessionId:string;actionId:string;toolName:string;toolInput:unknown;ttlMs:number}): void {
    const now=Date.now();
    this.repository.create({approvalId:input.approvalId,userId:input.userId,sessionId:input.sessionId,actionId:input.actionId,
      toolName:input.toolName,argumentHash:hashToolCall(input.toolName,input.toolInput),createdAt:now,expiresAt:now+input.ttlMs});
  }
  public consumeIfMatches(input:{approvalId:string;userId:string;sessionId:string;actionId:string;toolName:string;toolInput:unknown}): boolean {
    return this.repository.consumeIfMatches({approvalId:input.approvalId,userId:input.userId,sessionId:input.sessionId,
      actionId:input.actionId,toolName:input.toolName,argumentHash:hashToolCall(input.toolName,input.toolInput)});
  }
  public getActive(approvalId:string) { return this.repository.getActive(approvalId); }
}