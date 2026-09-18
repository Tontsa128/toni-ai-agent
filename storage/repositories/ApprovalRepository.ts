import type Database from "better-sqlite3";

export interface ApprovalRecord {
  approvalId: string; userId: string; sessionId: string; actionId: string;
  toolName: string; argumentHash: string; createdAt: number; expiresAt: number; used: boolean;
}
interface ApprovalRow {
  approval_id: string; user_id: string; session_id: string; action_id: string;
  tool_name: string; argument_hash: string; created_at: number; expires_at: number; used: number;
}
export class ApprovalRepository {
  public constructor(private readonly db: Database.Database) {}
  public create(input: Omit<ApprovalRecord, "used">): ApprovalRecord {
    this.db.prepare(`INSERT INTO approvals
      (approval_id,user_id,session_id,action_id,tool_name,argument_hash,created_at,expires_at,used)
      VALUES (?,?,?,?,?,?,?, ?,0)`).run(input.approvalId,input.userId,input.sessionId,input.actionId,input.toolName,input.argumentHash,input.createdAt,input.expiresAt);
    return { ...input, used: false };
  }
  public getById(approvalId: string): ApprovalRecord | undefined {
    const row = this.db.prepare("SELECT * FROM approvals WHERE approval_id=?").get(approvalId) as ApprovalRow | undefined;
    return row ? mapRow(row) : undefined;
  }
  public getActive(approvalId: string, now = Date.now()): ApprovalRecord | undefined {
    const row = this.db.prepare(`SELECT * FROM approvals
      WHERE approval_id=? AND used=0 AND expires_at>?`).get(approvalId, now) as ApprovalRow | undefined;
    return row ? mapRow(row) : undefined;
  }
  public consumeIfMatches(input: {
    approvalId:string; userId:string; sessionId:string; actionId:string; toolName:string; argumentHash:string;
  }, now = Date.now()): boolean {
    const tx = this.db.transaction(() => {
      const result = this.db.prepare(`UPDATE approvals SET used=1
        WHERE approval_id=? AND user_id=? AND session_id=? AND action_id=? AND tool_name=?
        AND argument_hash=? AND used=0 AND expires_at>?`)
        .run(input.approvalId,input.userId,input.sessionId,input.actionId,input.toolName,input.argumentHash,now);
      return result.changes === 1;
    });
    return tx();
  }
  public deleteExpired(now = Date.now()): number {
    return this.db.prepare("DELETE FROM approvals WHERE expires_at <= ? OR used=1").run(now).changes;
  }
}
function mapRow(row: ApprovalRow): ApprovalRecord {
  return { approvalId:row.approval_id,userId:row.user_id,sessionId:row.session_id,actionId:row.action_id,
    toolName:row.tool_name,argumentHash:row.argument_hash,createdAt:row.created_at,expiresAt:row.expires_at,used:row.used===1 };
}