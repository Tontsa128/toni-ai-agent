import test from "node:test";
import assert from "node:assert/strict";
import { PermissionEngine } from "../agent/core/PermissionEngine.js";

const policy = {
  filesystem: { read: "allow", write: "workspace", delete: "approval" },
  terminal: { safe_commands: "allow", unknown_commands: "approval", destructive_commands: "approval" },
  git: { read: "allow", commit: "approval", push: "approval" },
  browser: { read: "approval", write: "approval", submit: "approval" },
  system: { settings: "approval", administrator: "never_auto" },
  school: { read_assignments: "allow", draft_answers: "allow", submit_assignment: "approval" }
};

test("safe read action remains green", () => {
  const engine = new PermissionEngine(policy);
  const result = engine.evaluate({ id: "1", tool: "filesystem", operation: "read", description: "read", risk: "green", requiresApproval: false, createdAt: new Date().toISOString() }, { mode: "coding", userRequest: "read" });
  assert.equal(result.risk, "green");
  assert.equal(result.requiresApproval, false);
});

test("school submission is red and requires approval", () => {
  const engine = new PermissionEngine(policy);
  const result = engine.evaluate({ id: "2", tool: "school", operation: "submit_assignment", description: "submit", risk: "green", requiresApproval: false, createdAt: new Date().toISOString() }, { mode: "school", userRequest: "submit" });
  assert.equal(result.risk, "red");
  assert.equal(result.requiresApproval, true);
});
