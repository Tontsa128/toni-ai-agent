import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CodingAgent } from "../agent/coding/CodingAgent.js";
import type { PermissionPolicy } from "../agent/core/PermissionEngine.js";
import type { VerificationResult } from "../agent/coding/VerificationEngine.js";
import type { RepairPlan } from "../agent/debug/SelfDebugger.js";

const policy: PermissionPolicy = {
  filesystem: { read: "allow", write: "workspace", delete: "approval" },
  terminal: { safe_commands: "allow", unknown_commands: "approval", destructive_commands: "approval" },
  git: { read: "allow", commit: "approval", push: "approval" },
  browser: { read: "approval", write: "approval", submit: "approval" },
  system: { settings: "approval", administrator: "never_auto" },
  school: { read_assignments: "allow", analyse: "allow", draft_answers: "allow", write_to_school_portal: "approval", submit_assignment: "approval", send_messages: "approval" }
};

const plan: RepairPlan = {
  outcome: "repair_plan",
  summary: "safe correction",
  suspectedCause: "code_or_type_error",
  nextChecks: ["run check"],
  safeToRetry: true
};

const failed: VerificationResult = { ok: false, steps: [], repairPlan: plan };
const passed: VerificationResult = { ok: true, steps: [] };

function agent(workspace: string, persistenceFile: string, verify: (attempt: number) => Promise<VerificationResult>, repair: (plan: RepairPlan, attempt: number, approved: boolean) => Promise<{ status: "approval_required"; actionId: string; description: string } | { status: "repaired" }>) {
  return new CodingAgent(workspace, policy, {
    resumableRepair: {
      persistence: { filePath: persistenceFile, sessionId: "integration-session" },
      verify,
      repair
    }
  });
}

test("CodingAgent restores a waiting repair session and resumes it after approval", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "toni-ai-agent-coding-"));
  const persistenceFile = join(workspace, ".agent", "repair-session.json");
  try {
    let firstVerifications = 0;
    const first = agent(
      workspace,
      persistenceFile,
      async () => {
        firstVerifications += 1;
        return failed;
      },
      async () => ({ status: "approval_required", actionId: "persisted-repair-1", description: "Apply safe correction" })
    );

    const waiting = await first.startRepair();
    assert.equal(waiting.state, "waiting_approval");
    assert.equal(firstVerifications, 1);

    const persisted = JSON.parse(await readFile(persistenceFile, "utf8")) as { sessionId: string; state: string; approval?: { actionId: string } };
    assert.equal(persisted.sessionId, "integration-session");
    assert.equal(persisted.state, "waiting_approval");
    assert.equal(persisted.approval?.actionId, "persisted-repair-1");

    let secondVerifications = 0;
    const second = agent(
      workspace,
      persistenceFile,
      async () => {
        secondVerifications += 1;
        return passed;
      },
      async (_plan, _attempt, approved) => {
        assert.equal(approved, true);
        return { status: "repaired" };
      }
    );

    assert.equal(second.getRepairSnapshot().state, "waiting_approval");
    const succeeded = await second.approveRepair("persisted-repair-1");
    assert.equal(succeeded.state, "succeeded");
    assert.equal(secondVerifications, 1);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
