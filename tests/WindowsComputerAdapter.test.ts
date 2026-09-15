import assert from "node:assert/strict";
import test from "node:test";
import { ComputerInputPolicy, WindowsComputerAdapter } from "../computer/WindowsComputerAdapter.js";

test("ComputerInputPolicy accepts normal coordinates", () => {
  assert.doesNotThrow(() => ComputerInputPolicy.assertCoordinate(100, 200));
});

test("ComputerInputPolicy rejects invalid coordinates", () => {
  assert.throws(() => ComputerInputPolicy.assertCoordinate(-1, 10), /Invalid screen coordinate/);
  assert.throws(() => ComputerInputPolicy.assertCoordinate(Number.NaN, 10), /Invalid screen coordinate/);
  assert.throws(() => ComputerInputPolicy.assertCoordinate(10001, 10), /Invalid screen coordinate/);
  assert.throws(() => ComputerInputPolicy.assertCoordinate(10.5, 20), /Invalid screen coordinate/);
});

test("WindowsComputerAdapter blocks credential-like text before OS execution", async () => {
  const adapter = new WindowsComputerAdapter();
  await assert.rejects(() => adapter.type("my API key is secret"), /Credential or authentication-code entry is blocked/);
});
