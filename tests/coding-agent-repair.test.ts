import test from "node:test";
import assert from "node:assert/strict";
import { CodingAgent } from "../agent/coding/CodingAgent.js";
import type { VerificationResult } from "../agent/coding/VerificationEngine.js";
import type { SessionRepairAction } from "../agent/coding/RepairSession.js";
import type { PermissionPolicy } from "../agent/core/PermissionEngine.js";

const policy: PermissionPolicy = {
  filesystem: { read: "allow", write: "workspace", delete: "approval" },
  terminal: { safe_commands: "allow", unknown_commands: "approval", destructive_commands: "approval" },
  git: { read: "allow", commit: "approval", push: "approval" },
  browser: { read: "approval", write: "approval", submit: "approval" },
  system: { settings: "approval", administrator: "never_auto" },
  school: {
    read_assignments: "allow",
    analyse_assignments: "allow",
    draft_answers: "allow",
    write_to_school_portal: "approval",
    submit_assignment: "approval",
    send_messages: "approval"
  }
};

const plan = {
  outcome: "retry" as const,
  summary: "safe repair",
  suspectedCause: "code_or_type_error",
  nextChecks: ["run tests"],
  safeToRetry: true
};
const failed = (): VerificationResult => ({ ok: false, steps: [], repairPlan: plan });
const passed = (): VerificationResult => ({ ok: true, steps: [] });

function createAgent(
  verify: (attempt: number) => Promise<VerificationResult>,
  repair: SessionRepairAction
) {
  return new CodingAgent("C:/toni-ai-agent", policy, {
    model: "test-model",
    resumableRepair: { verify, repair }
  });
}

test("CodingAgent exposes resumable repair as a first-class coding workflow", async () => {
  let verifyCount = 0;
  const approved: boolean[] = [];
  const agent = createAgent(
    async () => {
      verifyCount += 1;
      return verifyCount === 1 ? failed() : passed();
    },
    async (_plan, attempt, isApproved) => {
      assert.equal(attempt, 1);
      approved.push(isApproved);
      return isApproved
        ? { status: "repaired" }
        : { status: "approval_required", actionId: "coding-repair-1", description: "Apply safe coding repair" };
    }
  );

  const waiting = await agent.startRepair();
  assert.equal(waiting.state, "waiting_approval");
  assert.equal(waiting.approval?.actionId, "coding-repair-1");

  const wrong = await agent.approveRepair("wrong-id");
  assert.equal(wrong.state, "waiting_approval");
  assert.equal(approved.length, 1);

  const resumed = await agent.approveRepair("coding-repair-1");
  assert.equal(resumed.state, "succeeded");
  assert.deepEqual(approved, [false, true]);
  assert.equal(verifyCount, 2);
});

test("CodingAgent rejects a resumable repair without executing it", async () => {
  let repairs = 0;
  const agent = createAgent(
    async () => failed(),
    async () => {
      repairs += 1;
      return { status: "approval_required", actionId: "coding-repair-2", description: "Apply repair" };
    }
  );

  await agent.startRepair();
  const rejected = agent.rejectRepair("coding-repair-2");

  assert.equal(rejected.state, "rejected");
  assert.equal(rejected.reason, "Repair approval rejected");
  assert.equal(repairs, 1);
});
