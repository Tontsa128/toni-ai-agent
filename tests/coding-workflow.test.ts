import test from "node:test";
import assert from "node:assert/strict";
import { CodingWorkflow } from "../app/CodingWorkflow.js";
import { InteractiveSession } from "../app/InteractiveSession.js";
import type { VerificationResult } from "../agent/coding/VerificationEngine.js";

const policy = {
  filesystem: { read: "allow" as const, write: "workspace" as const, delete: "approval" as const },
  terminal: { safe_commands: "allow" as const, unknown_commands: "approval" as const, destructive_commands: "approval" as const },
  git: { read: "allow" as const, commit: "approval" as const, push: "approval" as const },
  browser: { read: "approval" as const, write: "approval" as const, submit: "approval" as const },
  system: { settings: "approval" as const, administrator: "never_auto" as const },
  school: {
    read_assignments: "allow" as const,
    analyse_assignments: "allow" as const,
    draft_answers: "allow" as const,
    write_to_school_portal: "approval" as const,
    submit_assignment: "approval" as const,
    send_messages: "approval" as const
  }
};

const plan = {
  outcome: "retry" as const,
  summary: "safe repair",
  suspectedCause: "code_or_type_error",
  nextChecks: ["run check"],
  safeToRetry: true
};
const failed = (): VerificationResult => ({ ok: false, steps: [], repairPlan: plan });
const passed = (): VerificationResult => ({ ok: true, steps: [] });

test("shared CodingWorkflow owns one resumable CodingAgent repair session", async () => {
  let verifies = 0;
  let repairs = 0;
  const workflow = new CodingWorkflow("C:/toni-ai-agent", policy, {
    resumableRepair: {
      verify: async () => {
        verifies += 1;
        return verifies === 1 ? failed() : passed();
      },
      repair: async (_plan, _attempt, approved) => {
        repairs += 1;
        return approved
          ? { status: "repaired" }
          : { status: "approval_required", actionId: "shared-repair-1", description: "Apply repair" };
      }
    }
  });

  const waiting = await workflow.startRepair();
  assert.equal(waiting.state, "waiting_approval");
  assert.equal(workflow.getRepairSnapshot().approval?.actionId, "shared-repair-1");

  const session = new InteractiveSession({ workspace: "C:/toni-ai-agent", codingWorkflow: workflow });
  assert.equal(session.getState().pendingRepairApproval?.actionId, "shared-repair-1");

  const wrong = await session.approve("not-the-real-id");
  assert.match(wrong, /Korjaus odottaa edelleen hyväksyntää/);
  assert.equal(repairs, 1);

  const success = await session.approve("shared-repair-1");
  assert.equal(success, "Korjaus hyväksyttiin ja varmennus onnistui.");
  assert.equal(workflow.getRepairSnapshot().state, "succeeded");
  assert.equal(verifies, 2);
  assert.equal(repairs, 2);
});

test("tool and repair approvals remain isolated in the shared workflow", async () => {
  let repairCalls = 0;
  const workflow = new CodingWorkflow("C:/toni-ai-agent", policy, {
    resumableRepair: {
      verify: async () => failed(),
      repair: async () => {
        repairCalls += 1;
        return { status: "approval_required", actionId: "repair-only", description: "Apply repair" };
      }
    }
  });
  const session = new InteractiveSession({ workspace: "C:/toni-ai-agent", codingWorkflow: workflow });

  await session.startRepair();
  await assert.rejects(() => session.approve("tool-action-id"), /No resumable approval found/);
  assert.equal(repairCalls, 1);
  assert.equal(workflow.getRepairSnapshot().state, "waiting_approval");
});
