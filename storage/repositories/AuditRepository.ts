import { createHash } from "node:crypto";
import type Database from "better-sqlite3";

export interface AuditEvent {
  type: string;
  userId?: string;
  sessionId?: string;
  actionId?: string;
  toolName?: string;
  message: string;
  createdAt?: number;
}
interface AuditRow {
  id: number;
  event_type: string;
  user_id: string | null;
  session_id: string | null;
  action_id: string | null;
  tool_name: string | null;
  message: string;
  created_at: number;
  previous_hash: string | null;
  hash: string;
}

export class AuditRepository {
  public constructor(private readonly db: Database.Database) {}
  public initialize(): void {}
  public append(event: AuditEvent): void {
    const tx = this.db.transaction(() => {
      const previous = this.db.prepare("SELECT hash FROM audit_events ORDER BY id DESC LIMIT 1").get() as { hash: string } | undefined;
      const previousHash = previous?.hash ?? "";
      const createdAt = event.createdAt ?? Date.now();
      const hash = hashAuditEvent({
        type: event.type,
        userId: event.userId ?? null,
        sessionId: event.sessionId ?? null,
        actionId: event.actionId ?? null,
        toolName: event.toolName ?? null,
        message: event.message,
        createdAt,
        previousHash
      });
      this.db.prepare("INSERT INTO audit_events (event_type,user_id,session_id,action_id,tool_name,message,created_at,previous_hash,hash) VALUES (?,?,?,?,?,?,?,?,?)")
        .run(event.type,event.userId ?? null,event.sessionId ?? null,event.actionId ?? null,event.toolName ?? null,event.message,createdAt,previousHash,hash);
    });
    tx();
  }

  public verify(): { ok: true; count: number } | { ok: false; count: number; error: string } {
    const rows = this.db.prepare("SELECT * FROM audit_events ORDER BY id ASC").all() as AuditRow[];
    let previousHash = "";
    for (const row of rows) {
      if ((row.previous_hash ?? "") !== previousHash) {
        return { ok: false, count: row.id - 1, error: "Audit hash chain predecessor mismatch at event " + row.id + "." };
      }
      const expected = hashAuditEvent({
        type: row.event_type,
        userId: row.user_id,
        sessionId: row.session_id,
        actionId: row.action_id,
        toolName: row.tool_name,
        message: row.message,
        createdAt: row.created_at,
        previousHash
      });
      if (expected !== row.hash) {
        return { ok: false, count: row.id - 1, error: "Audit hash mismatch at event " + row.id + "." };
      }
      previousHash = row.hash;
    }
    return { ok: true, count: rows.length };
  }
}

function hashAuditEvent(input: {
  type: string;
  userId: string | null;
  sessionId: string | null;
  actionId: string | null;
  toolName: string | null;
  message: string;
  createdAt: number;
  previousHash: string;
}): string {
  const payload = JSON.stringify(input);
  return createHash("sha256").update(payload, "utf8").digest("hex");
}
