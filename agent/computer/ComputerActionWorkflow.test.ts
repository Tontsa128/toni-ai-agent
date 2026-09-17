import assert from "node:assert/strict";
import test from "node:test";
import { ComputerActionWorkflow } from "./ComputerActionWorkflow.js";

function observation(capturedAt: string) {
  return { capturedAt, monitorId: "virtual-screen", activeWindowTitle: "Test", activeApplication: "test-app", visibleText: "Saved" };
}

test("ComputerActionWorkflow re-observes inconclusive verification within policy bound", async () => {
  const observations = [observation("2026-09-17T12:00:01.000Z"), observation("2026-09-17T12:00:02.000Z")];
  let captures = 0;
  const controller = {
    async proposeAndQueue() { return { proposal: { action: { type: "click", x: 1, y: 2 }, observationCapturedAt: "2026-09-17T12:00:00.000Z", actionId: "a1" }, result: { ok: true, approved: false, output: { actionId: "a1" } } }; },
    async approve() { return { result: { ok: true, approved: true, output: { ok: true } }, validation: { status: "accepted", reason: "ok" } }; },
    reject() {}
  };
  const lifecycle = {
    recordProposal() {}, recordApprovalRequested() {}, recordApproval() {}, recordRejection() {}, recordExecution() { return { status: "accepted", reason: "ok" }; },
    recordPostCondition(_s: string, _a: string, obs: typeof observations[number], _e: unknown) {
      return { status: obs.capturedAt.endsWith("01.000Z") ? "inconclusive" : "confirmed", reason: "test" } as const;
    }
  };
  const policy = { decide(validation: { status: string }, attempt: number) { return validation.status === "confirmed" ? "complete" : attempt < 2 ? "observe_again" : "stop"; } };
  const workflow = new ComputerActionWorkflow(controller as never, lifecycle as never, { async capture() { return observations[captures++]; } }, policy as never);

  await workflow.propose(observation("2026-09-17T11:59:59.000Z"), { type: "click", x: 1, y: 2 }, "s1");
  const result = await workflow.approveAndVerify("a1", "s1", { visibleTextIncludes: ["Saved"] });

  assert.equal(result.postCondition?.status, "confirmed");
  assert.equal(result.verificationAttempts, 2);
  assert.equal(captures, 2);
});

test("ComputerActionWorkflow stops after bounded inconclusive observations", async () => {
  let captures = 0;
  const controller = { async proposeAndQueue() { return { proposal: { action: { type: "click", x: 1, y: 2 }, observationCapturedAt: "2026-09-17T12:00:00.000Z", actionId: "a2" }, result: { ok: true, approved: false, output: { actionId: "a2" } } }; }, async approve() { return { result: { ok: true, approved: true, output: { ok: true } }, validation: { status: "accepted", reason: "ok" } }; }, reject() {} };
  const lifecycle = { recordProposal() {}, recordApprovalRequested() {}, recordApproval() {}, recordRejection() {}, recordExecution() { return { status: "accepted", reason: "ok" }; }, recordPostCondition() { return { status: "inconclusive", reason: "no text" }; } };
  const workflow = new ComputerActionWorkflow(controller as never, lifecycle as never, { async capture() { captures += 1; return observation(`2026-09-17T12:00:0${captures}.000Z`); } }, { decide: (_v: unknown, attempt: number) => attempt < 2 ? "observe_again" : "stop" } as never);

  await workflow.propose(observation("2026-09-17T11:59:59.000Z"), { type: "click", x: 1, y: 2 }, "s2");
  const result = await workflow.approveAndVerify("a2", "s2", { visibleTextIncludes: ["Saved"] });

  assert.equal(result.postCondition?.status, "inconclusive");
  assert.equal(result.verificationAttempts, 2);
  assert.equal(captures, 2);
});
