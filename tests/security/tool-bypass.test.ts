import test from "node:test";
import assert from "node:assert/strict";
import { ToolRegistry } from "../../agent/tools/ToolRegistry.js";
import { SafeToolExecutor } from "../../agent/tools/SafeToolExecutor.js";
import { SessionBudget } from "../../agent/limits/SessionBudget.js";
import { AgentOrchestrator } from "../../agent/core/AgentOrchestrator.js";
import { SupervisedToolExecutor } from "../../agent/supervisor/SupervisedToolExecutor.js";
import type { ApprovalRecord } from "../../agent/approvals/ApprovalStore.js";

const policy = {
  filesystem: { read: "allow", write: "workspace", delete: "approval" },
  terminal: { safe_commands: "allow", unknown_commands: "approval", destructive_commands: "approval" },
  git: { read: "allow", commit: "approval", push: "approval", reset: "approval" },
  github: { read: "allow", write: "approval", merge: "approval", delete: "never_auto" },
  browser: { read: "allow", write: "approval", submit: "approval", download: "approval" },
  computer: { read: "allow", click: "approval", type: "approval", system: "never_auto" },
  system: { settings: "approval", administrator: "never_auto", shutdown: "never_auto" },
  school: { read_assignments: "allow", analyse_assignments: "allow", draft_answers: "allow", write_to_school_portal: "approval", submit_assignment: "approval", send_messages: "approval" }
} as const;

class MemoryApprovals {
  private readonly records = new Map<string, ApprovalRecord>();

  async put(input: Omit<ApprovalRecord, "createdAt" | "expiresAt" | "used">): Promise<ApprovalRecord> {
    const record: ApprovalRecord = { ...input, createdAt: Date.now(), expiresAt: Date.now() + 120_000, used: false };
    this.records.set(record.approvalId, record);
    return record;
  }
  get(id: string): ApprovalRecord | undefined {
    const r = this.records.get(id);
    return r && !r.used && r.expiresAt > Date.now() ? { ...r } : undefined;
  }
  async consume(id: string, sessionId: string, actionId: string, argumentHash: string): Promise<ApprovalRecord> {
    const r = this.get(id);
    if (!r || r.sessionId !== sessionId || r.actionId !== actionId || r.argumentHash !== argumentHash) {
      throw new Error("invalid approval");
    }
    r.used = true;
    this.records.set(id, r);
    return r;
  }
}

test("yellow tool cannot execute without supervisor approval", async () => {
  const registry = new ToolRegistry();
  let executions = 0;
  registry.register({
    name: "dangerous_test_tool",
    risk: "yellow",
    description: "test",
    validateInput: (input: unknown) => input,
    async execute() { executions += 1; return "executed"; }
  });

  const audit = { append: () => undefined };
  const approvals = new MemoryApprovals();
  const orchestrator = new AgentOrchestrator(policy);
  const supervisor = new SupervisedToolExecutor(
    registry,
    new SafeToolExecutor(registry, new SessionBudget(2)),
    approvals,
    audit,
    orchestrator,
    { mode: "coding", workspace: process.cwd(), userRequest: "security test" }
  );

  const result = await supervisor.execute({
    sessionId: "session-1",
    actionId: "action-1",
    toolName: "dangerous_test_tool",
    input: "test",
    signal: new AbortController().signal
  });

  assert.equal(result.executed, false);
  assert.equal(result.approved, false);
  assert.equal(executions, 0);
  assert.equal((result.output as { status?: string }).status, "approval_required");
});

test("red tool remains blocked even when a normal approval is supplied", async () => {
  const registry = new ToolRegistry();
  let executions = 0;
  registry.register({
    name: "red_test_tool",
    risk: "red",
    description: "test",
    validateInput: (input: unknown) => input,
    async execute() { executions += 1; return "executed"; }
  });

  const audit = { append: () => undefined };
  const approvals = new MemoryApprovals();
  const orchestrator = new AgentOrchestrator(policy);
  const supervisor = new SupervisedToolExecutor(
    registry,
    new SafeToolExecutor(registry, new SessionBudget(2)),
    approvals,
    audit,
    orchestrator,
    { mode: "coding", workspace: process.cwd(), userRequest: "security test" }
  );

  await assert.rejects(
    supervisor.execute({
      sessionId: "session-1",
      actionId: "action-1",
      toolName: "red_test_tool",
      input: "test",
      approvalId: "ordinary-approval",
      signal: new AbortController().signal
    })
  );
  assert.equal(executions, 0);
});
