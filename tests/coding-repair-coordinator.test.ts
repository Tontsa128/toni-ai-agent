import test from "node:test";
import assert from "node:assert/strict";
import { CodingRepairCoordinator } from "../agent/coding/CodingRepairCoordinator.js";
import type { VerificationResult } from "../agent/coding/VerificationEngine.js";

const passed = (): VerificationResult => ({ ok: true, steps: [] });
const failed = (safeToRetry = true): VerificationResult => ({
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

test("CodingRepairCoordinator verifies, repairs and verifies again", async () => {
  let verifyCount = 0;
  let repairCount = 0;

  const result = await new CodingRepairCoordinator({
    maxAttempts: 3,
    verify: async (attempt) => {
      assert.equal(attempt, ++verifyCount);
      return verifyCount === 1 ? failed() : passed();
    },
    repair: async (_plan, attempt) => {
      assert.equal(attempt, 1);
      repairCount += 1;
      return true;
    }
  }).run();

  assert.equal(result.ok, true);
  assert.equal(verifyCount, 2);
  assert.equal(repairCount, 1);
});

test("CodingRepairCoordinator preserves the unsafe-retry stop", async () => {
  let repairs = 0;

  const result = await new CodingRepairCoordinator({
    verify: async () => failed(false),
    repair: async () => {
      repairs += 1;
      return true;
    }
  }).run();

  assert.equal(result.ok, false);
  assert.equal(repairs, 0);
});

test("CodingRepairCoordinator can pause and resume a resumable repair", async () => {
  let verifyCount = 0;
  const calls: boolean[] = [];

  const coordinator = new CodingRepairCoordinator({
    mode: "resumable",
    maxAttempts: 3,
    verify: async () => {
      verifyCount += 1;
      return verifyCount === 1 ? failed() : passed();
    },
    repair: async (_plan, attempt, approved) => {
      assert.equal(attempt, 1);
      calls.push(approved);
      return approved
        ? { status: "repaired" }
        : { status: "approval_required", actionId: "repair-1", description: "Apply repair" };
    }
  });

  const waiting = await coordinator.start();
  assert.equal(waiting.state, "waiting_approval");
  assert.equal(waiting.approval?.actionId, "repair-1");

  const resumed = await coordinator.approve("repair-1");
  assert.equal(resumed.state, "succeeded");
  assert.deepEqual(calls, [false, true]);
  assert.equal(verifyCount, 2);
});

test("CodingRepairCoordinator rejects resumable repair with the exact action id", async () => {
  const coordinator = new CodingRepairCoordinator({
    mode: "resumable",
    verify: async () => failed(),
    repair: async () => ({
      status: "approval_required",
      actionId: "repair-2",
      description: "Apply repair"
    })
  });

  await coordinator.start();
  const rejected = coordinator.reject("repair-2");
  assert.equal(rejected.state, "rejected");
  assert.equal(rejected.reason, "Repair approval rejected");
});
