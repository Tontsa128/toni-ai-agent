import test from "node:test";
import assert from "node:assert/strict";
import { RepairLoop } from "../agent/coding/RepairLoop.js";
import type { VerificationResult } from "../agent/coding/VerificationEngine.js";

const passed = (): VerificationResult => ({ ok: true, steps: [] });
const failed = (safeToRetry: boolean): VerificationResult => ({
  ok: false,
  steps: [],
  repairPlan: {
    outcome: safeToRetry ? "retry" : "blocked",
    summary: "verification failed",
    suspectedCause: safeToRetry ? "code_or_type_error" : "permission_or_access",
    nextChecks: ["inspect failure"],
    safeToRetry
  }
});

test("repairs once and verifies again", async () => {
  const verifiedAttempts: number[] = [];
  const repairAttempts: number[] = [];
  let verificationCount = 0;

  const result = await new RepairLoop({ maxAttempts: 3 }).run(
    async (attempt) => {
      verifiedAttempts.push(attempt);
      verificationCount += 1;
      return verificationCount === 1 ? failed(true) : passed();
    },
    async (_plan, attempt) => {
      repairAttempts.push(attempt);
      return true;
    }
  );

  assert.equal(result.ok, true);
  assert.deepEqual(verifiedAttempts, [1, 2]);
  assert.deepEqual(repairAttempts, [1]);
  assert.equal(result.attempts.length, 2);
});

test("never auto-retries an unsafe permission failure", async () => {
  let repairs = 0;
  let verifications = 0;

  const result = await new RepairLoop({ maxAttempts: 3 }).run(
    async () => {
      verifications += 1;
      return failed(false);
    },
    async () => {
      repairs += 1;
      return true;
    }
  );

  assert.equal(result.ok, false);
  assert.equal(verifications, 1);
  assert.equal(repairs, 0);
  assert.equal(result.attempts[0]?.stopped, true);
});

test("stops when the repair action cannot complete", async () => {
  let verifications = 0;
  const result = await new RepairLoop({ maxAttempts: 3 }).run(
    async () => {
      verifications += 1;
      return failed(true);
    },
    async () => false
  );

  assert.equal(result.ok, false);
  assert.equal(verifications, 1);
  assert.equal(result.attempts[0]?.reason, "Repair action did not complete");
});

test("caps automatic repair cycles at the configured maximum", async () => {
  let verifications = 0;
  let repairs = 0;

  const result = await new RepairLoop({ maxAttempts: 3 }).run(
    async () => {
      verifications += 1;
      return failed(true);
    },
    async () => {
      repairs += 1;
      return true;
    }
  );

  assert.equal(result.ok, false);
  assert.equal(verifications, 3);
  assert.equal(repairs, 2);
  assert.equal(result.attempts.at(-1)?.reason, "Repair attempt limit reached");
});
