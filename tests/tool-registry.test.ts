import test from "node:test";
import assert from "node:assert/strict";
import { ToolRegistry } from "../agent/tools/ToolRegistry.js";

const tool = {
  name: "test_tool",
  risk: "green" as const,
  description: "Test tool",
  validateInput(input: unknown): string {
    if (typeof input !== "string") throw new Error("string required");
    return input;
  },
  async execute(input: string): Promise<string> { return input; }
};

test("registry rejects duplicate and invalid names", () => {
  const registry = new ToolRegistry();
  registry.register(tool);
  assert.throws(() => registry.register(tool), /already registered/);
  assert.throws(() => registry.register({ ...tool, name: "Invalid Tool" }), /Invalid tool name/);
});
