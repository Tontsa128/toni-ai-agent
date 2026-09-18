import test from "node:test";
import assert from "node:assert/strict";
import { Metrics } from "../../app/observability/Metrics.js";
test("metrics count failed requests", () => {
  const metrics = new Metrics(); metrics.requestStarted(); metrics.requestFailed();
  const snapshot = metrics.snapshot(); assert.equal(snapshot.requestsTotal,1); assert.equal(snapshot.requestsFailed,1);
});
