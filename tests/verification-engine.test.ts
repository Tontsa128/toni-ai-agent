import test from "node:test";
import assert from "node:assert/strict";
import { VerificationEngine } from "../agent/coding/VerificationEngine.js";
import type { ExecutionResult } from "../agent/sandbox/types.js";

const ok = (stdout = "ok") => ({ ok: true, exitCode: 0, stdout, stderr: "" });

test("runs check, test and build in deterministic order", async () => {
  const calls: string[] = [];
  const engine = new VerificationEngine(
    { check: "npm run check", test: "npm test", build: "npm run build" },
    async (command) => { calls.push(command); return ok(); }
  );

  const result = await engine.verify();
  assert.equal(result.ok, true);
  assert.deepEqual(calls, ["npm run check", "npm test", "npm run build"]);
  assert.equal(result.steps.length, 3);
});

test("falls back to typecheck when check is absent", () => {
  const engine = new VerificationEngine({ typecheck: "npm run typecheck" }, async () => ok());
  assert.deepEqual(engine.availableCommands(), [{ name: "check", command: "npm run typecheck" }]);
});

test("stops at the first failed verification and produces a repair plan", async () => {
  const calls: string[] = [];
  const debuggerStub = {
    analyse(failure: { operation: string; error: string; attempt: number }) {
      return {
        outcome: "retry" as const,
        summary: failure.error,
        suspectedCause: "code_or_type_error",
        nextChecks: ["inspect compiler output"],
        safeToRetry: true
      };
    }
  };
  const engine = new VerificationEngine(
    { check: "npm run check", test: "npm test", build: "npm run build" },
    async (command) => {
      calls.push(command);
      return command === "npm run check"
        ? { ok: false, exitCode: 2, stdout: "", stderr: "TS2345 type error" }
        : ok();
    },
    debuggerStub
  );

  const result = await engine.verify();
  assert.equal(result.ok, false);
  assert.deepEqual(calls, ["npm run check"]);
  assert.equal(result.failedStep?.name, "check");
  assert.equal(result.repairPlan?.safeToRetry, true);
});

test("does not fabricate verification when no scripts exist", async () => {
  const engine = new VerificationEngine({}, async () => ok());
  const result = await engine.verify();
  assert.equal(result.ok, true);
  assert.equal(result.steps[0]?.skipped, true);
});

test("binds verification to the supplied terminal executor and workspace", async () => {
  const calls: Array<{ command: string; cwd: string }> = [];
  const executor = {
    async run(request: { command: string; cwd: string }): Promise<ExecutionResult> {
      calls.push(request);
      return { ok: true, exitCode: 0, stdout: "ok", stderr: "", durationMs: 1, blocked: false };
    }
  };

  const engine = VerificationEngine.fromTerminalExecutor(
    { check: "npm run check", test: "npm test" },
    executor,
    "C:/workspace"
  );
  const result = await engine.verify();

  assert.equal(result.ok, true);
  assert.deepEqual(calls, [
    { command: "npm run check", cwd: "C:/workspace" },
    { command: "npm test", cwd: "C:/workspace" }
  ]);
});

test("preserves a blocked terminal result and stops before later scripts", async () => {
  const calls: string[] = [];
  const executor = {
    async run(request: { command: string; cwd: string }): Promise<ExecutionResult> {
      calls.push(request.command);
      return {
        ok: false,
        exitCode: null,
        stdout: "",
        stderr: "",
        durationMs: 0,
        blocked: true,
        reason: "Executable is not allowlisted"
      };
    }
  };

  const engine = VerificationEngine.fromTerminalExecutor(
    { check: "dangerous-command", test: "npm test" },
    executor,
    "/workspace"
  );
  const result = await engine.verify();

  assert.equal(result.ok, false);
  assert.equal(result.failedStep?.blocked, true);
  assert.equal(result.failedStep?.reason, "Executable is not allowlisted");
  assert.deepEqual(calls, ["dangerous-command"]);
});
