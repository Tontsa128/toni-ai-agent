import test from "node:test";
import assert from "node:assert/strict";
import { ScreenMonitor } from "../../agent/vision/ScreenMonitor.js";
import type { ScreenObservation } from "../../agent/vision/ScreenObservation.js";

const observation: ScreenObservation = {
  capturedAt: new Date().toISOString(),
  monitorId: "test-monitor",
  activeApplication: "test",
  activeWindowTitle: "test"
};

test("screen monitor is off and captures nothing until explicitly enabled", async () => {
  let captures = 0;
  const monitor = new ScreenMonitor({
    async capture() { captures += 1; return observation; }
  });
  assert.equal(monitor.getState(), "off");
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(captures, 0);
  monitor.enable();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(monitor.getState(), "on");
  assert.equal(captures, 1);
  monitor.disable();
  assert.equal(monitor.getState(), "off");
});
