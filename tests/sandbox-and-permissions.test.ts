import test from "node:test";
import assert from "node:assert/strict";
import { ExecutionSandbox } from "../agent/sandbox/ExecutionSandbox.js";
import { PermissionEngine } from "../agent/core/PermissionEngine.js";

const policy = { filesystem: { read: "allow", write: "workspace", delete: "approval" }, terminal: { safe_commands: "allow", unknown_commands: "approval", destructive_commands: "approval" }, git: { read: "allow", commit: "approval", push: "approval" }, browser: { read: "approval", write: "approval", submit: "approval" }, system: { settings: "approval", administrator: "never_auto" }, school: {} };

test("sandbox blocks commands outside workspace", () => {
  const sandbox = new ExecutionSandbox({ workspaceRoot: process.cwd(), network: "deny", maxExecutionMs: 1000, maxOutputBytes: 1000, allowCommands: ["node"], denyPatterns: ["shutdown"] });
  const result = sandbox.preflight({ command: "node -e \"console.log(1)\"", cwd: process.cwd() + "-outside" });
  assert.equal(result.blocked, true);
});

test("destructive operation requires approval", () => {
  const engine = new PermissionEngine(policy);
  const action = engine.evaluate({ id: "1", tool: "terminal", operation: "delete_file", description: "delete", risk: "green", requiresApproval: false, createdAt: new Date().toISOString() }, { mode: "coding", userRequest: "delete" });
  assert.notEqual(action.risk, "green");
  assert.equal(action.requiresApproval, true);
});
