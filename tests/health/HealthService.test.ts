import test from "node:test";
import assert from "node:assert/strict";
import { HealthService } from "../../app/health/HealthService.js";
import { StartupState } from "../../app/lifecycle/StartupState.js";

test("health remains degraded before server-ready", () => {
  const state = new StartupState();
  const health = new HealthService({ configurationReady: true, approvalStoreReady: true, modelConfigured: true, startupState: state });
  assert.equal(health.getStatus().status, "degraded");
  state.setPhase("config_loaded");
  assert.equal(health.getStatus().checks.runtime, "not_ready");
});
test("health becomes ok only after server-ready", () => {
  const state = new StartupState();
  const health = new HealthService({ configurationReady: true, approvalStoreReady: true, modelConfigured: true, startupState: state });
  state.setPhase("config_loaded"); state.setPhase("storage_ready"); state.setPhase("tools_ready"); state.setPhase("providers_ready"); state.setPhase("sandbox_ready"); state.setPhase("server_ready");
  assert.equal(health.getStatus().status, "ok");
});
