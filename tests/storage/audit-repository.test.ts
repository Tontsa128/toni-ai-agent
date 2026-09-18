import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { AuditRepository } from "../../storage/repositories/AuditRepository.js";

function schema(db: Database.Database): void {
  db.exec("CREATE TABLE audit_events (id INTEGER PRIMARY KEY AUTOINCREMENT,event_type TEXT NOT NULL,user_id TEXT,session_id TEXT,action_id TEXT,tool_name TEXT,message TEXT NOT NULL,created_at INTEGER NOT NULL,previous_hash TEXT,hash TEXT NOT NULL)");
}

test("audit hash chain survives repository restart", () => {
  const db = new Database(":memory:");
  schema(db);
  const first = new AuditRepository(db);
  first.append({ type: "one", message: "first", createdAt: 1000 });
  assert.deepEqual(first.verify(), { ok: true, count: 1 });
  const second = new AuditRepository(db);
  second.append({ type: "two", sessionId: "s1", message: "second", createdAt: 2000 });
  assert.deepEqual(second.verify(), { ok: true, count: 2 });
  db.close();
});

test("audit tampering is detected", () => {
  const db = new Database(":memory:");
  schema(db);
  const audit = new AuditRepository(db);
  audit.append({ type: "one", message: "first", createdAt: 1000 });
  db.prepare("UPDATE audit_events SET message=? WHERE id=1").run("tampered");
  const result = audit.verify();
  assert.equal(result.ok, false);
  db.close();
});