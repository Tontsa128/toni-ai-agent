import test from "node:test";
import assert from "node:assert/strict";
import { SelfDebugger } from "../agent/debug/SelfDebugger.js";

test("self debugger bounds retries", () => {
  const debuggerAgent = new SelfDebugger(2);
  const first = debuggerAgent.analyse({ operation: "build", error: "TS2307 Cannot find module", attempt: 1 });
  assert.equal(first.outcome, "retry");
  assert.equal(first.safeToRetry, true);

  const exhausted = debuggerAgent.analyse({ operation: "build", error: "TS2307 Cannot find module", attempt: 2 });
  assert.equal(exhausted.outcome, "failed");
  assert.equal(exhausted.safeToRetry, false);
});

test("self debugger never bypasses access controls", () => {
  const debuggerAgent = new SelfDebugger();
  const result = debuggerAgent.analyse({ operation: "school-read", error: "HTTP 403 Forbidden", attempt: 1 });
  assert.equal(result.outcome, "retry");
  assert.equal(result.safeToRetry, false);
});
