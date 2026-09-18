import test from "node:test";
import assert from "node:assert/strict";
import { StartupState } from "../../app/lifecycle/StartupState.js";
import { runStartupChecks } from "../../app/health/StartupChecks.js";

test("application becomes ready only after startup", () => {
  const state = new StartupState();
  assert.equal(state.isReady(), false);
  state.setPhase("config_loaded");
  state.setPhase("storage_ready");
  state.setPhase("tools_ready");
  state.setPhase("providers_ready");
  state.setPhase("sandbox_ready");
  assert.equal(state.isReady(), false);
  state.setPhase("server_ready");
  assert.equal(state.isReady(), true);
});

test("required production startup checks fail closed", async () => {
  await assert.rejects(
    () => runStartupChecks([{ name: "required", requiredInProduction: true, async run() { throw new Error("broken"); } }], true),
    /Required startup check failed/
  );
});