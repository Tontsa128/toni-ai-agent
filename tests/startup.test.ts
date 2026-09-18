import test from "node:test";
import assert from "node:assert/strict";
import { access, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializeAgentRuntime } from "../app/startup.js";

test("startup stops at configuration before creating later runtime stages", async () => {
  const previousModel = process.env.OPENAI_MODEL;
  const previousKey = process.env.OPENAI_API_KEY;
  const workspace = join(tmpdir(), `toni-startup-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  delete process.env.OPENAI_MODEL;
  delete process.env.OPENAI_API_KEY;

  try {
    await assert.rejects(
      () => initializeAgentRuntime(workspace),
      /OPENAI_MODEL is required/,
    );
    await assert.rejects(
      () => access(join(workspace, "memory", "approvals.json")),
    );
  } finally {
    if (previousModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = previousModel;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    await rm(workspace, { recursive: true, force: true });
  }
});
