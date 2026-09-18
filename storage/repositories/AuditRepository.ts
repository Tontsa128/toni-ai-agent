import { createHash } from "node:crypto";
import type Database from "better-sqlite3";

export interface AuditEvent {
  type:string; userId?:string; sessionId?:string; actionId?:string; toolName?:string; message:string; createdAt?:number;
}
export class AuditRepository {
  public constructor(private readonly db: Database.Database) {}
  public initialize(): void {
    // The previous hash is read inside each append transaction, so multiple
    // Node processes sharing SQLite cannot fork the hash chain.
  }
  public append(event: AuditEvent): void {
    const tx = this.db.transaction(() => {
      const previous = this.db.prepare("SELECT hash FROM audit_events ORDER BY id DESC LIMIT 1").get() as {hash:string}|undefined;
      const previousHash = previous?.hash ?? "";
      const createdAt = event.createdAt ?? Date.now();
      const payload = JSON.stringify({type:event.type,userId:event.userId??null,sessionId:event.sessionId??null,
        actionId:event.actionId??null,toolName:event.toolName??null,message:event.message,createdAt,previousHash});
      const hash = createHash("sha256").update(payload,"utf8").digest("hex");
      this.db.prepare(`INSERT INTO audit_events
        (event_type,user_id,session_id,action_id,tool_name,message,created_at,previous_hash,hash)
        VALUES (?,?,?,?,?,?,?,?,?)`).run(event.type,event.userId??null,event.sessionId??null,event.actionId??null,
        event.toolName??null,event.message,createdAt,previousHash,hash);
    });
    tx();
  }
}