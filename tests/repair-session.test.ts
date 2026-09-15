import test from "node:test";
import assert from "node:assert/strict";
import { RepairSession } from "../agent/coding/RepairSession.js";
import type { RepairPlan } from "../agent/debug/SelfDebugger.js";
import type { VerificationResult } from "../agent/coding/VerificationEngine.js";

const plan: RepairPlan = {
  outcome: "retry",
  summary: "safe code correction",
  suspectedCause: "code_or_type_error",
  nextChecks: ["run check"],
  safeToRetry: true
};

const failed = (): VerificationResult => ({ ok: false, steps: [], repairPlan: plan });
const passed = (): VerificationResult => ({ ok: true, steps: [] });

test("pauses for approval and resumes the exact pending repair", async () => {
  const verified: number[] = [];
  const calls: Array<{ attempt: number; approved: boolean }> = [];
  let verificationCount = 0;
  const session = new RepairSession({ maxAttempts: 3 });
  const waiting = await session.start(async (attempt) => { verified.push(attempt); verificationCount += 1; return verificationCount === 1 ? failed() : passed(); }, async (repairPlan, attempt, approved) => {
    assert.equal(repairPlan, plan); calls.push({ attempt, approved });
    return approved ? { status: "repaired" } : { status: "approval_required", actionId: "repair-1", description: "Apply the proposed code correction" };
  });
  assert.equal(waiting.state, "waiting_approval");
  const resumed = await session.approve("repair-1");
  assert.equal(resumed.state, "succeeded");
  assert.deepEqual(verified, [1, 2]);
  assert.deepEqual(calls, [{ attempt: 1, approved: false }, { attempt: 1, approved: true }]);
  assert.equal(resumed.attempt, 2);
});

test("rejecting approval stops the session", async () => {
  const session = new RepairSession();
  const waiting = await session.start(async () => failed(), async () => ({ status: "approval_required", actionId: "repair-reject", description: "Apply repair" }));
  const rejected = session.reject("repair-reject");
  assert.equal(waiting.state, "waiting_approval");
  assert.equal(rejected.state, "rejected");
  assert.equal(rejected.reason, "Repair approval rejected");
  const unchanged = await session.approve("repair-reject");
  assert.equal(unchanged.state, "rejected");
});

test("wrong approval id cannot resume a pending repair", async () => {
  let approvedCalls = 0;
  const session = new RepairSession();
  await session.start(async () => failed(), async (_plan, _attempt, approved) => {
    if (approved) approvedCalls += 1;
    return { status: "approval_required", actionId: "real-id", description: "Apply repair" };
  });
  const unchanged = await session.approve("wrong-id");
  assert.equal(unchanged.state, "waiting_approval");
  assert.equal(approvedCalls, 0);
  assert.equal(unchanged.approval?.actionId, "real-id");
});

test("unsafe failures never enter repair or approval", async () => {
  const unsafe: VerificationResult = { ok: false, steps: [], repairPlan: { ...plan, outcome: "blocked", safeToRetry: false } };
  let repairs = 0;
  const session = new RepairSession();
  const result = await session.start(async () => unsafe, async () => { repairs += 1; return { status: "repaired" }; });
  assert.equal(result.state, "failed"); assert.equal(repairs, 0); assert.equal(result.reason, "Repair plan is not safe for automatic retry");
});

test("never exceeds three verification attempts", async () => {
  let verifications = 0; let repairs = 0;
  const session = new RepairSession({ maxAttempts: 99 });
  const result = await session.start(async () => { verifications += 1; return failed(); }, async () => { repairs += 1; return { status: "repaired" }; });
  assert.equal(result.state, "failed"); assert.equal(verifications, 3); assert.equal(repairs, 2); assert.equal(result.reason, "Repair attempt limit reached");
});

test("verification exceptions fail the session instead of leaking an error", async () => {
  const session = new RepairSession();
  const result = await session.start(async () => { throw new Error("verification runner crashed"); }, async () => ({ status: "repaired" }));
  assert.equal(result.state, "failed"); assert.equal(result.reason, "verification runner crashed");
});

test("concurrent start calls perform only one verification", async () => {
  let verifications = 0; const session = new RepairSession();
  const verify = async () => { verifications += 1; await new Promise((resolve) => setTimeout(resolve, 5)); return passed(); };
  const repair = async () => ({ status: "repaired" as const });
  const [first, second] = await Promise.all([session.start(verify, repair), session.start(verify, repair)]);
  assert.equal(verifications, 1); assert.equal(first.state, "succeeded"); assert.deepEqual(second, first);
});
