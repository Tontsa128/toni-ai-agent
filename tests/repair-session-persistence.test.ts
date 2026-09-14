import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CodingRepairCoordinator } from "../agent/coding/CodingRepairCoordinator.js";
import type { VerificationResult } from "../agent/coding/VerificationEngine.js";

const plan = {
  outcome: "retry" as const,
  summary: "safe repair with token=sk_live_secret_should_not_persist",
  suspectedCause: "code_or_type_error",
  nextChecks: ["run tests"],
  safeToRetry: true
};

const failed = (): VerificationResult => ({
  ok: false,
  steps: [{ name: "check", command: "npm run check", ok: false, skipped: false, stdout: "password=secret", stderr: "api_key=hidden" }],
  repairPlan: plan
});

const passed = (): VerificationResult => ({ ok: true, steps: [] });

test("resumable repair can restore a waiting approval without rerunning verification", async () => {
  const directory = mkdtempSync(join(tmpdir(), "toni-ai-repair-"));
  const filePath = join(directory, "session.json");
  try {
    let firstVerify = 0;
    const first = new CodingRepairCoordinator({
      mode: "resumable",
      persistence: { filePath, sessionId: "session-1" },
      verify: async () => { firstVerify += 1; return failed(); },
      repair: async (_plan, _attempt, approved) => approved
        ? { status: "repaired" }
        : { status: "approval_required", actionId: "repair-1", description: "Apply repair" }
    });

    const waiting = await first.start();
    assert.equal(waiting.state, "waiting_approval");
    assert.equal(firstVerify, 1);

    const persisted = JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
    assert.equal(persisted.sessionId, "session-1");
    assert.equal(persisted.state, "waiting_approval");
    assert.doesNotMatch(JSON.stringify(persisted), /sk_live_secret|password=secret|api_key=hidden/);

    let restoredVerify = 0;
    let restoredRepairs = 0;
    const restored = new CodingRepairCoordinator({
      mode: "resumable",
      persistence: { filePath, sessionId: "session-1" },
      verify: async () => { restoredVerify += 1; return passed(); },
      repair: async (_plan, _attempt, approved) => {
        restoredRepairs += 1;
        return approved ? { status: "repaired" } : { status: "approval_required", actionId: "repair-1", description: "Apply repair" };
      }
    });

    assert.equal(restored.snapshot().state, "waiting_approval");
    const result = await restored.start();
    assert.equal(result.state, "waiting_approval");
    assert.equal(restoredVerify, 0);

    const approved = await restored.approve("repair-1");
    assert.equal(approved.state, "succeeded");
    assert.equal(restoredRepairs, 1);
    assert.equal(restoredVerify, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
