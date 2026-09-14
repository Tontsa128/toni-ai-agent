import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AuditLog } from "../agent/audit/AuditLog.js";

test("AuditLog appends sanitized lifecycle events", () => {
  const directory = mkdtempSync(join(tmpdir(), "toni-audit-"));
  const filePath = join(directory, "audit.jsonl");
  const log = new AuditLog({ filePath });

  log.append({
    type: "repair_approval_requested",
    sessionId: "session-1",
    attempt: 1,
    actionId: "action-1",
    summary: "token=super-secret repair for package"
  });
  log.append({
    type: "repair_approved",
    sessionId: "session-1",
    attempt: 1,
    actionId: "action-1"
  });

  const lines = readFileSync(filePath, "utf8").trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].type, "repair_approval_requested");
  assert.equal(lines[0].summary, "token=[REDACTED] repair for package");
  assert.equal(lines[1].type, "repair_approved");
  assert.equal(typeof lines[0].eventId, "string");
  assert.equal(typeof lines[0].timestamp, "string");
});
