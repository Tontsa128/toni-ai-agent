import test from "node:test";
import assert from "node:assert/strict";
import { VerificationEngine } from "../agent/coding/VerificationEngine.js";

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
