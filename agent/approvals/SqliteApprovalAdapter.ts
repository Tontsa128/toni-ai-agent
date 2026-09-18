import { ApprovalRepository, type ApprovalRecord } from "../../storage/repositories/ApprovalRepository.js";
import { hashToolCall } from "../security/ToolCallHash.js";

export class SqliteApprovalAdapter {
  public constructor(private readonly repository: ApprovalRepository, private readonly ttlMs: number) {}

  public async put(input: { approvalId:string; userId:string; sessionId:string; actionId:string; toolName:string; argumentHash:string }): Promise<ApprovalRecord> {
    const now = Date.now();
    return this.repository.create({ ...input, createdAt: now, expiresAt: now + this.ttlMs });
  }

  public getActive(id:string): ApprovalRecord | undefined { return this.repository.getActive(id); }

  public async consume(id:string,sessionId:string,actionId:string,argumentHash:string,userId:string,toolName:string):Promise<ApprovalRecord>{
    const record = this.repository.consumeIfMatchesAndReturn({ approvalId:id,userId,sessionId,actionId,toolName,argumentHash });
    if (!record) throw new Error("Approval is invalid, expired, already used, or mismatched.");
    return record;
  }

  public consumeIfMatches(input:{approvalId:string;userId:string;sessionId:string;actionId:string;toolName:string;toolInput:unknown}):boolean{
    return this.repository.consumeIfMatches({ ...input, argumentHash: hashToolCall(input.toolName,input.toolInput) });
  }
}
