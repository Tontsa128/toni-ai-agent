import assert from "node:assert/strict";
import test from "node:test";
import { ComputerActionWorkflow } from "../agent/computer/ComputerActionWorkflow.js";

const baseline = "2026-09-17T12:00:00.000Z";
const fresh = "2026-09-17T12:00:01.000Z";

const observation = { capturedAt: baseline, monitorId: "virtual-screen" };
const freshObservation = { capturedAt: fresh, monitorId: "virtual-screen", visibleText: "Saved successfully" };

function lifecycleStub() {
  return {
    recordProposal: (..._args: unknown[]) => undefined,
    recordApprovalRequested: (..._args: unknown[]) => undefined,
    recordApproval: (..._args: unknown[]) => undefined,
    recordExecution: (..._args: unknown[]) => ({ status: "accepted" as const, reason: "ok" }),
    recordPostCondition: (..._args: unknown[]) => ({ status: "confirmed" as const, reason: "matched" }),
    recordRejection: (..._args: unknown[]) => undefined
  };
}

test("workflow stores queued actions and verifies only after fresh capture", async () => {
  let captures = 0;
  const controller = {
    proposeAndQueue: async () => ({
      proposal: { actionId: "action-1", action: { type: "click" as const, x: 10, y: 20 }, observationCapturedAt: baseline },
      result: { ok: true, approved: false, output: { actionId: "action-1" } }
    }),
    approve: async () => ({ result: { ok: true, approved: true, output: { ok: true } }, validation: { status: "accepted" as const, reason: "ok" } }),
    reject: () => undefined
  };
  const observations = { capture: async () => { captures += 1; return freshObservation; } };
  const lifecycle = lifecycleStub();
  const workflow = new ComputerActionWorkflow(controller as never, lifecycle as never, observations);

  const queued = await workflow.propose(observation, { type: "click", x: 10, y: 20 }, "session-1");
  const result = await workflow.approveAndVerify("action-1", "session-1", { visibleTextIncludes: ["saved"] });

  assert.equal(queued.proposal.actionId, "action-1");
  assert.equal(result.postCondition?.status, "confirmed");
  assert.equal(captures, 1);
});

test("workflow does not capture a post-condition when execution validation fails", async () => {
  let captures = 0;
  const controller = {
    proposeAndQueue: async () => ({
      proposal: { actionId: "action-2", action: { type: "keypress" as const, key: "ENTER" }, observationCapturedAt: baseline },
      result: { ok: true, approved: false, output: { actionId: "action-2" } }
    }),
    approve: async () => ({ result: { ok: false, approved: false, output: { error: "not approved" } }, validation: { status: "failed" as const, reason: "not approved" } }),
    reject: () => undefined
  };
  const observations = { capture: async () => { captures += 1; return freshObservation; } };
  const lifecycle = { ...lifecycleStub(), recordExecution: (..._args: unknown[]) => ({ status: "failed" as const, reason: "not approved" }) };
  const workflow = new ComputerActionWorkflow(controller as never, lifecycle as never, observations);

  await workflow.propose(observation, { type: "keypress", key: "ENTER" }, "session-2");
  const result = await workflow.approveAndVerify("action-2", "session-2", { visibleTextIncludes: ["saved"] });

  assert.equal(result.execution.validation.status, "failed");
  assert.equal(result.postCondition, undefined);
  assert.equal(captures, 0);
});
