import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { AuditRepository } from "../../storage/repositories/AuditRepository.js";

function db(): Database.Database {
  const database = new Database(":memory:");
  database.exec(`CREATE TABLE audit_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT NOT NULL, user_id TEXT, session_id TEXT,
    action_id TEXT, tool_name TEXT, message TEXT NOT NULL, created_at INTEGER NOT NULL,
    previous_hash TEXT, hash TEXT NOT NULL
  )`);
  return database;
}
test("audit retention preserves a verifiable chain", () => {
  const database = db(); const audit = new AuditRepository(database);
  audit.append({ type: "a", message: "one", createdAt: 1 });
  audit.append({ type: "b", message: "two", createdAt: 2 });
  audit.append({ type: "c", message: "three", createdAt: 3 });
  assert.equal(audit.retainAfter(2).removed, 2);
  assert.deepEqual(audit.verify(), { ok: true, count: 1 });
  database.close();
});
test("retention on an empty prefix is a no-op", () => {
  const database = db(); const audit = new AuditRepository(database);
  audit.append({ type: "a", message: "one", createdAt: 10 });
  assert.deepEqual(audit.retainAfter(1), { retained: 1, removed: 0 });
  database.close();
});
