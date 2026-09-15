import test from "node:test";
import assert from "node:assert/strict";
import { ScreenContextAssistant } from "../agent/vision/ScreenContextAssistant.js";
import { ScreenObservationGate } from "../agent/vision/ScreenObservation.js";
import { ScreenMonitor } from "../agent/vision/ScreenMonitor.js";

// This file intentionally uses no real screen capture: the privacy contract
// is tested with an injected provider so CI never captures a machine screen.

test("screen observation is off by default and capture is blocked", async () => {
  const gate = new ScreenObservationGate();
  assert.equal(gate.getState(), "off");
  assert.throws(() => gate.assertEnabled(), /disabled by the user/);
});

test("screen monitor only captures after explicit enable", async () => {
  let captures = 0;
  const monitor = new ScreenMonitor({
    capture: async () => {
      captures += 1;
      return { capturedAt: new Date().toISOString(), monitorId: "test" };
    }
  }, { intervalMs: 1000 });

  assert.equal(monitor.getState(), "off");
  monitor.enable();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(monitor.getState(), "on");
  assert.ok(captures >= 1);
  monitor.disable();
  assert.equal(monitor.getState(), "off");
  await assert.rejects(() => monitor.captureNow(), /disabled by the user/);
});

test("disabling monitoring prevents later observations from being delivered", async () => {
  let delivered = 0;
  let releaseCapture: (() => void) | undefined;
  const monitor = new ScreenMonitor({
    capture: async () => new Promise((resolve) => {
      releaseCapture = () => resolve({ capturedAt: new Date().toISOString(), monitorId: "test" });
    })
  }, { intervalMs: 1000, onObservation: () => { delivered += 1; } });

  monitor.enable();
  await new Promise((resolve) => setTimeout(resolve, 5));
  monitor.disable();
  releaseCapture?.();
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(delivered, 0);
});

test("study context produces a proactive plan suggestion", () => {
  const assistant = new ScreenContextAssistant();
  const suggestion = assistant.analyse({
    capturedAt: new Date().toISOString(),
    monitorId: "test",
    activeWindowTitle: "Liiketoimintasuunnitelma - Oppimistehtävä",
    visibleText: "Tehtävänanto: tee liiketoimintasuunnitelma ja raportti."
  });

  assert.equal(suggestion?.kind, "school");
  assert.match(suggestion?.message ?? "", /suunnitelman/i);
});

test("ordinary screen content does not create a school suggestion", () => {
  const assistant = new ScreenContextAssistant();
  const suggestion = assistant.analyse({
    capturedAt: new Date().toISOString(),
    monitorId: "test",
    activeWindowTitle: "Laskin",
    visibleText: "123 + 456"
  });
  assert.equal(suggestion, undefined);
});
