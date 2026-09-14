import test from "node:test";
import assert from "node:assert/strict";
import { ExecutionSandbox } from "../agent/sandbox/ExecutionSandbox.js";

const sandbox = new ExecutionSandbox({
  workspaceRoot: process.cwd(),
  network: "deny",
  maxExecutionMs: 1000,
  maxOutputBytes: 1000,
  allowCommands: ["node", "npm"],
  denyPatterns: ["shutdown"]
});

test("allows a simple allowlisted command", () => {
  const result = sandbox.preflight({ command: "node --version", cwd: process.cwd() });
  assert.equal(result.ok, true);
  assert.equal(result.blocked, false);
});

test("blocks shell command chaining and redirection", () => {
  for (const command of [
    "node --version && node --version",
    "node --version; node --version",
    "node --version | node --version",
    "node --version > output.txt",
    "node --version $(whoami)"
  ]) {
    const result = sandbox.preflight({ command, cwd: process.cwd() });
    assert.equal(result.ok, false);
    assert.equal(result.blocked, true);
    assert.equal(result.reason, "Shell control operators are not allowed");
  }
});

test("blocks commands outside the executable allowlist", () => {
  const result = sandbox.preflight({ command: "powershell -Command Get-Date", cwd: process.cwd() });
  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
  assert.match(result.reason ?? "", /not allowlisted/);
});

test("blocks a denied safety pattern", () => {
  const result = sandbox.preflight({ command: "node shutdown", cwd: process.cwd() });
  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
  assert.equal(result.reason, "Command matches a denied safety pattern");
});
