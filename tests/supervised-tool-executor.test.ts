import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rm, readFile } from "node:fs/promises";
import { ApprovalStore } from "../agent/approvals/ApprovalStore.js";
import { AuditLog } from "../agent/audit/AuditLog.js";
import { AgentOrchestrator } from "../agent/core/AgentOrchestrator.js";
import { SafeToolExecutor } from "../agent/tools/SafeToolExecutor.js";
import { SessionBudget } from "../agent/limits/SessionBudget.js";
import { ToolRegistry } from "../agent/tools/ToolRegistry.js";
import { SupervisedToolExecutor } from "../agent/supervisor/SupervisedToolExecutor.js";
import { hashToolCall } from "../agent/security/ToolCallHash.js";

const policy = {
  filesystem: { read: "allow", write: "workspace", delete: "approval" },
  terminal: { safe_commands: "allow", unknown_commands: "approval", destructive_commands: "approval" },
  git: { read: "allow", commit: "approval", push: "approval" },
  browser: { read: "approval", write: "approval", submit: "approval" },
  system: { settings: "approval", administrator: "never_auto", shutdown: "never_auto" },
  school: { read_assignments: "allow", analyse_assignments: "allow", draft_answers: "allow", write_to_school_portal: "approval", submit_assignment: "approval", send_messages: "approval" }
} as const;

async function make() {
  const dir = join(tmpdir(), `toni-supervisor-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const approvals = new ApprovalStore(join(dir, "approvals.json"), 60_000);
  await approvals.init();
  const audit = new AuditLog({ filePath: join(dir, "audit.log") });
  const registry = new ToolRegistry();
  registry.register({
    name: "safe_echo",
    description: "Safe echo",
    risk: "green",
    validateInput(input: unknown): string {
      if (typeof input !== "string") throw new Error("Expected string.");
      return input;
    },
    async execute(input: string) { return input; }
  });
  registry.register({
    name: "red_echo",
    description: "Red echo",
    risk: "red",
    validateInput(input: unknown): string {
      if (typeof input !== "string") throw new Error("Expected string.");
      return input;
    },
    async execute(input: string) { return input; }
  });
  registry.register({
    name: "yellow_echo",
    description: "Yellow echo",
    risk: "yellow",
    validateInput(input: unknown): string {
      if (typeof input !== "string") throw new Error("Expected string.");
      return input;
    },
    async execute(input: string) { return input; }
  });
  const orchestrator = new AgentOrchestrator(policy);
  const safe = new SafeToolExecutor(registry, new SessionBudget(3));
  const supervisor = new SupervisedToolExecutor(
    registry,
    safe,
    approvals,
    audit,
    orchestrator,
    { mode: "coding", userRequest: "test" }
  );
  return { dir, approvals, audit, supervisor };
}

test("green tool executes without approval", async () => {
  const { dir, supervisor } = await make();
  try {
    const result = await supervisor.execute({
      sessionId: "session-1",
      actionId: "action-1",
      toolName: "safe_echo",
      input: "hello",
      signal: new AbortController().signal
    });
    assert.equal(result.output, "hello");
    assert.equal(result.executed, true);
    assert.equal(result.approved, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("yellow tool requires approval and does not execute", async () => {
  const { dir, supervisor } = await make();
  try {
    const result = await supervisor.execute({
      sessionId: "session-1",
      actionId: "action-2",
      toolName: "yellow_echo",
      input: "hello",
      signal: new AbortController().signal
    });
    assert.equal(result.executed, false);
    assert.equal((result.output as { status: string }).status, "approval_required");
    assert.equal((result.output as { actionId: string }).actionId, "action-2");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("yellow approval is bound to session action and arguments and is one-time", async () => {
  const { dir, approvals, supervisor } = await make();
  try {
    const queued = await supervisor.execute({
      sessionId: "session-1",
      actionId: "action-3",
      toolName: "yellow_echo",
      input: "hello",
      signal: new AbortController().signal
    });
    const approvalId = String((queued.output as { approvalId: string }).approvalId);
    const resumed = await supervisor.execute({
      sessionId: "session-1",
      actionId: "action-3",
      approvalId,
      toolName: "yellow_echo",
      input: "hello",
      signal: new AbortController().signal
    });
    assert.equal(resumed.output, "hello");
    assert.equal(resumed.executed, true);
    assert.equal(approvals.get(approvalId), undefined);
    await assert.rejects(
      () => supervisor.execute({
        sessionId: "session-1",
        actionId: "action-3",
        approvalId,
        toolName: "yellow_echo",
        input: "hello",
        signal: new AbortController().signal
      }),
      /Approval is invalid or expired/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("red tool stays blocked even with a valid approval", async () => {
  const { dir, approvals, supervisor } = await make();
  try {
    await approvals.put({
      approvalId: "red-approval",
      sessionId: "session-1",
      actionId: "red-action",
      argumentHash: hashToolCall("red_echo", "hello")
    });
    await assert.rejects(
      () => supervisor.execute({
        sessionId: "session-1",
        actionId: "red-action",
        approvalId: "red-approval",
        toolName: "red_echo",
        input: "hello",
        signal: new AbortController().signal
      }),
      /APPROVAL_REQUIRED|Red tool requires explicit approval/
    );
    assert.ok(approvals.get("red-approval"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("audit contains approval lifecycle and execution events", async () => {
  const { dir, supervisor } = await make();
  try {
    const queued = await supervisor.execute({
      sessionId: "session-1",
      actionId: "action-4",
      toolName: "yellow_echo",
      input: "hello",
      signal: new AbortController().signal
    });
    const approvalId = String((queued.output as { approvalId: string }).approvalId);
    await supervisor.execute({
      sessionId: "session-1",
      actionId: "action-4",
      approvalId,
      toolName: "yellow_echo",
      input: "hello",
      signal: new AbortController().signal
    });
    const content = await readFile(join(dir, "audit.log"), "utf8");
    assert.match(content, /approval_requested/);
    assert.match(content, /approval_consumed/);
    assert.match(content, /tool_allowed/);
    assert.match(content, /tool_executed/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
