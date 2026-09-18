import test from "node:test";
import assert from "node:assert/strict";
import { CancellationRegistry } from "../agent/core/CancellationRegistry.js";
import { SessionLock } from "../agent/core/SessionLock.js";
import { SessionBudget } from "../agent/limits/SessionBudget.js";

test("session lock rejects concurrent execution and always unlocks", async () => {
  const lock = new SessionLock();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const first = lock.runExclusive(async () => {
    await gate;
    return "ok";
  });
  await assert.rejects(() => lock.runExclusive(async () => "second"), /already has an active operation/);
  release();
  assert.equal(await first, "ok");
  assert.equal(lock.isActive(), false);
});

test("cancellation registry aborts and removes an operation", () => {
  const registry = new CancellationRegistry();
  const signal = registry.create("op-1");
  assert.equal(registry.has("op-1"), true);
  assert.equal(registry.cancel("op-1"), true);
  assert.equal(signal.aborted, true);
  assert.equal(registry.has("op-1"), false);
  assert.equal(registry.cancel("op-1"), false);
});

test("session budget stops tool calls at the configured limit", () => {
  const budget = new SessionBudget(2);
  budget.consumeToolCall();
  budget.consumeToolCall();
  assert.equal(budget.getRemaining(), 0);
  assert.throws(() => budget.consumeToolCall(), /budget exceeded/);
});
