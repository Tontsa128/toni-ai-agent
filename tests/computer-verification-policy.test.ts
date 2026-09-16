import assert from "node:assert/strict";
import test from "node:test";
import { ComputerVerificationPolicy } from "../agent/computer/ComputerVerificationPolicy.js";

test("confirmed verification completes immediately", () => {
  const policy = new ComputerVerificationPolicy();
  assert.equal(policy.decide({ status: "confirmed", reason: "ok" }, 1), "complete");
});

test("inconclusive verification requests one bounded observation retry", () => {
  const policy = new ComputerVerificationPolicy({ maxObservationAttempts: 2 });
  assert.equal(policy.decide({ status: "inconclusive", reason: "no OCR" }, 1), "observe_again");
  assert.equal(policy.decide({ status: "inconclusive", reason: "no OCR" }, 2), "stop");
});

test("negative verification stops instead of retrying the computer action", () => {
  const policy = new ComputerVerificationPolicy({ maxObservationAttempts: 3 });
  assert.equal(policy.decide({ status: "not_confirmed", reason: "mismatch" }, 1), "stop");
});

test("policy bounds observation attempts", () => {
  assert.throws(() => new ComputerVerificationPolicy({ maxObservationAttempts: 0 }));
  assert.throws(() => new ComputerVerificationPolicy({ maxObservationAttempts: 4 }));
  assert.throws(() => new ComputerVerificationPolicy().decide({ status: "inconclusive", reason: "x" }, 0));
});
