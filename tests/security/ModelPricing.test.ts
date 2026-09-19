import test from "node:test";
import assert from "node:assert/strict";
import { estimateModelCost } from "../../agent/providers/ModelPricing.js";
test("unknown model pricing fails closed", () => {
  assert.throws(() => estimateModelCost("unknown-model", 10, 10), /No pricing configured/);
});
test("known model pricing is deterministic", () => {
  assert.equal(estimateModelCost("gpt-5.6-luna", 1_000_000, 1_000_000), 1.4);
});
