import test from "node:test";
import assert from "node:assert/strict";
import { SafeToolExecutor } from "../agent/tools/SafeToolExecutor.js";
import { ToolRegistry } from "../agent/tools/ToolRegistry.js";
import { SessionBudget } from "../agent/limits/SessionBudget.js";

test("safe executor validates input and enforces session budget", async () => {
  const registry = new ToolRegistry();
  registry.register({
    name: "echo_tool",
    risk: "green",
    description: "Echo",
    validateInput(input: unknown): string {
      if (typeof input !== "string") throw new Error("Input must be a string.");
      return input;
    },
    async execute(input): Promise<string> { return input; }
  });
  const executor = new SafeToolExecutor(registry, new SessionBudget(1));
  const context = { sessionId: "session-1", signal: new AbortController().signal };
  const result = await executor.execute("echo_tool", "hello", context);
  assert.equal(result.output, "hello");
  await assert.rejects(() => executor.execute("echo_tool", "again", context), /budget exceeded/);
});
