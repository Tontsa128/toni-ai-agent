import assert from "node:assert/strict";
import test from "node:test";
import { ComputerInputPolicy } from "../computer/WindowsComputerAdapter.js";

test("ComputerInputPolicy accepts normal coordinates", () => {
  assert.doesNotThrow(() => ComputerInputPolicy.assertCoordinate(100, 200));
});

test("ComputerInputPolicy rejects invalid coordinates", () => {
  assert.throws(() => ComputerInputPolicy.assertCoordinate(-1, 10), /Invalid screen coordinate/);
  assert.throws(() => ComputerInputPolicy.assertCoordinate(Number.NaN, 10), /Invalid screen coordinate/);
  assert.throws(() => ComputerInputPolicy.assertCoordinate(100001, 10), /Invalid screen coordinate/);
});
