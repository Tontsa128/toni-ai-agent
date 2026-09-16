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
  const first = lines[0];
  const second = lines[1];
  assert.ok(first);
  assert.ok(second);
  assert.equal(lines.length, 2);
  assert.equal(first.type, "repair_approval_requested");
  assert.equal(first.summary, "token=[REDACTED] repair for package");
  assert.equal(second.type, "repair_approved");
  assert.equal(typeof first.eventId, "string");
  assert.equal(typeof first.timestamp, "string");
});

test("AuditLog accepts computer verification lifecycle events without raw screen data", () => {
  const directory = mkdtempSync(join(tmpdir(), "toni-audit-computer-"));
  const filePath = join(directory, "audit.jsonl");
  const log = new AuditLog({ filePath });

  log.append({
    type: "computer_action_proposed",
    sessionId: "computer-session-1",
    actionId: "action-42",
    summary: "click proposed for VS Code"
  });
  log.append({
    type: "computer_action_verification_confirmed",
    sessionId: "computer-session-1",
    actionId: "action-42",
    reason: "Build succeeded"
  });

  const lines = readFileSync(filePath, "utf8").trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
  assert.equal(lines.length, 2);
  assert.equal(lines[0]?.type, "computer_action_proposed");
  assert.equal(lines[1]?.type, "computer_action_verification_confirmed");
  assert.equal(lines[1]?.actionId, "action-42");
  assert.equal(lines[1]?.imageDataUrl, undefined);
});
