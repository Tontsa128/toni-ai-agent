import { ApprovalRepository, type ApprovalRecord } from "../../storage/repositories/ApprovalRepository.js";
import { hashToolCall } from "../security/ToolCallHash.js";

export class SqliteApprovalAdapter {
  public constructor(private readonly repository:ApprovalRepository,private readonly ttlMs:number) {}
  public async put(input:{approvalId:string;userId:string;sessionId:string;actionId:string;toolName:string;argumentHash:string}):Promise<ApprovalRecord>{
    const now=Date.now();
    return this.repository.create({...input,createdAt:now,expiresAt:now+this.ttlMs});
  }
  public getActive(id:string):ApprovalRecord|undefined{return this.repository.getActive(id);}
  public async consume(id:string,sessionId:string,actionId:string,argumentHash:string,userId:string,toolName:string):Promise<ApprovalRecord>{
    const ok=this.repository.consumeIfMatches({approvalId:id,userId,sessionId,actionId,toolName,argumentHash});
    if(!ok) throw new Error("Approval is invalid, expired, already used, or mismatched.");
    const record=this.repository.getActive(id);
    if(record) return record;
    return {...({approvalId:id,userId,sessionId,actionId,toolName,argumentHash,createdAt:0,expiresAt:Date.now(),used:true})};
  }
  public consumeIfMatches(input:{approvalId:string;userId:string;sessionId:string;actionId:string;toolName:string;toolInput:unknown}):boolean{
    return this.repository.consumeIfMatches({...input,argumentHash:hashToolCall(input.toolName,input.toolInput)});
  }
}