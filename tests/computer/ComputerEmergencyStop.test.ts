import test from "node:test";
import assert from "node:assert/strict";
import { ComputerEmergencyStop } from "../../agent/computer/ComputerEmergencyStop.js";

test("computer emergency stop blocks further actions", () => {
  const stop = new ComputerEmergencyStop();
  stop.assertRunning();
  stop.stop();
  assert.equal(stop.isStopped(), true);
  assert.throws(() => stop.assertRunning(), /emergency stop/i);
});
