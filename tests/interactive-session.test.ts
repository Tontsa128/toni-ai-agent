import test from "node:test";
import assert from "node:assert/strict";
import { InteractiveSession, parseSessionInput } from "../app/InteractiveSession.js";
import type { VerificationResult } from "../agent/coding/VerificationEngine.js";
import { ScreenContextAssistant } from "../agent/vision/ScreenContextAssistant.js";
import { ScreenObservationGate } from "../agent/vision/ScreenObservation.js";
import { ScreenMonitor } from "../agent/vision/ScreenMonitor.js";

const repairPlan = {
  outcome: "retry" as const,
  summary: "safe repair",
  suspectedCause: "code_or_type_error",
  nextChecks: ["run check"],
  safeToRetry: true
};
const failed = (): VerificationResult => ({ ok: false, steps: [], repairPlan });
const passed = (): VerificationResult => ({ ok: true, steps: [] });

test("interactive command parser handles built-in commands", () => {
  assert.deepEqual(parseSessionInput("/help"), { type: "help" });
  assert.deepEqual(parseSessionInput("/reset"), { type: "reset" });
  assert.deepEqual(parseSessionInput("/status"), { type: "status" });
  assert.deepEqual(parseSessionInput("/approvals"), { type: "approvals" });
  assert.deepEqual(parseSessionInput("/approve abc"), { type: "approve", actionId: "abc" });
  assert.deepEqual(parseSessionInput("/reject abc"), { type: "reject", actionId: "abc" });
  assert.deepEqual(parseSessionInput("/model gpt-5.6-luna"), { type: "model", value: "gpt-5.6-luna" });
  assert.deepEqual(parseSessionInput("/quit"), { type: "exit" });
  assert.deepEqual(parseSessionInput("Tarkista README"), { type: "request", value: "Tarkista README" });
  assert.deepEqual(parseSessionInput("   "), { type: "empty" });
});

test("interactive session changes model and resets conversation state without an API key", () => {
  const session = new InteractiveSession({ workspace: "C:/toni-ai-agent", model: "test-model" });
  assert.equal(session.getState().model, "test-model");
  assert.equal(session.executeCommand({ type: "model", value: "another-model" })?.text, "Malli vaihdettu: another-model");
  assert.equal(session.getState().model, "another-model");
  const reply = session.executeCommand({ type: "status" });
  assert.match(reply?.text ?? "", /Keskustelutila: tyhjä/);
  assert.equal(session.executeCommand({ type: "reset" })?.text, "Keskustelutila nollattu.");
  assert.equal(session.getState().requestCount, 0);
});

test("interactive session routes repair approval separately from tool approval", async () => {
  let verificationCount = 0;
  const approved: boolean[] = [];
  const session = new InteractiveSession({ workspace: "C:/toni-ai-agent", repair: {
    verify: async () => { verificationCount += 1; return verificationCount === 1 ? failed() : passed(); },
    repair: async (_plan, _attempt, isApproved) => { approved.push(isApproved); return isApproved ? { status: "repaired" } : { status: "approval_required", actionId: "repair-session-1", description: "Apply safe repair" }; }
  }});
  const waiting = await session.startRepair();
  assert.equal(waiting.state, "waiting_approval");
  assert.equal(session.getState().pendingRepairApproval?.actionId, "repair-session-1");
  const approvals = session.executeCommand({ type: "approvals" });
  assert.match(approvals?.text ?? "", /Korjaus: repair-session-1/);
  await assert.rejects(() => session.ask("jatka"), /Repair approval required first: \/approve repair-session-1/);
  const result = await session.approve("repair-session-1");
  assert.equal(result, "Korjaus hyväksyttiin ja varmennus onnistui.");
  assert.deepEqual(approved, [false, true]);
  assert.equal(verificationCount, 2);
});

test("wrong repair approval id does not execute the repair", async () => {
  let approvedCalls = 0;
  const session = new InteractiveSession({ workspace: "C:/toni-ai-agent", repair: {
    verify: async () => failed(),
    repair: async () => { approvedCalls += 1; return { status: "approval_required", actionId: "real-repair-id", description: "Apply repair" }; }
  }});
  await session.startRepair();
  const before = session.getState();
  const result = await session.approve("wrong-id");
  assert.equal(result, "Korjaus odottaa edelleen hyväksyntää: real-repair-id");
  assert.equal(approvedCalls, 1);
  assert.equal(session.getState().pendingRepairApproval?.actionId, "real-repair-id");
  assert.equal(session.getState().repairState, before.repairState);
});

test("screen observation gate is off by default", () => {
  const gate = new ScreenObservationGate();
  assert.equal(gate.getState(), "off");
  assert.throws(() => gate.assertEnabled(), /disabled by the user/);
  gate.enable();
  assert.equal(gate.getState(), "on");
  gate.disable();
  assert.equal(gate.getState(), "off");
});

test("screen monitor captures only while explicitly enabled", async () => {
  let captures = 0;
  const monitor = new ScreenMonitor({ capture: async () => { captures += 1; return { capturedAt: new Date().toISOString(), monitorId: "test" }; } }, { intervalMs: 1000 });
  assert.equal(monitor.getState(), "off");
  monitor.enable();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.ok(captures >= 1);
  monitor.disable();
  await assert.rejects(() => monitor.captureNow(), /disabled by the user/);
});

test("study screen context creates a proactive suggestion", () => {
  const assistant = new ScreenContextAssistant();
  const suggestion = assistant.analyse({ capturedAt: new Date().toISOString(), monitorId: "test", activeWindowTitle: "Liiketoimintasuunnitelma - Oppimistehtävä", visibleText: "Tehtävänanto: tee liiketoimintasuunnitelma ja raportti." });
  assert.equal(suggestion?.kind, "school");
  assert.match(suggestion?.message ?? "", /suunnitelman/i);
});

test("ordinary screen content does not create a school suggestion", () => {
  const assistant = new ScreenContextAssistant();
  const suggestion = assistant.analyse({ capturedAt: new Date().toISOString(), monitorId: "test", activeWindowTitle: "Laskin", visibleText: "123 + 456" });
  assert.equal(suggestion, undefined);
});
