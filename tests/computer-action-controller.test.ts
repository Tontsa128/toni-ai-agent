import assert from "node:assert/strict";
import test from "node:test";
import { ComputerActionController } from "../agent/computer/ComputerActionController.js";
import { AgentOrchestrator } from "../agent/core/AgentOrchestrator.js";
import { SupervisedToolExecutor } from "../agent/core/SupervisedToolExecutor.js";
import { ToolRegistry } from "../agent/tools/ToolRegistry.js";
import type { ScreenObservation } from "../agent/vision/ScreenObservation.js";

const policy = {
  filesystem: { read: "allow", write: "workspace", delete: "approval" },
  terminal: { safe_commands: "allow", unknown_commands: "approval", destructive_commands: "approval" },
  git: { read: "allow", commit: "approval", push: "approval", reset: "approval" },
  github: { read: "allow", write: "approval", merge: "approval", delete: "never_auto" },
  browser: { read: "approval", write: "approval", submit: "approval", download: "approval" },
  computer: { read: "approval", click: "approval", type: "approval", system: "never_auto" },
  system: { settings: "approval", administrator: "never_auto", shutdown: "never_auto" },
  school: { read_assignments: "allow", analyse: "allow", draft_answers: "allow", write_to_school_portal: "approval", submit_assignment: "approval", send_messages: "approval" }
} as const;

function makeController(executed: unknown[]): { controller: ComputerActionController; orchestrator: AgentOrchestrator } {
  const registry = new ToolRegistry();
  for (const name of ["computer_click", "computer_type", "computer_keypress"]) {
    registry.register({
      name,
      description: name,
      risk: "yellow",
      async execute(input) {
        executed.push({ name, input });
        return { executed: true, name, input };
      }
    });
  }
  const orchestrator = new AgentOrchestrator(policy);
  const executor = new SupervisedToolExecutor(orchestrator, registry, { mode: "computer", userRequest: "help" });
  return { controller: new ComputerActionController(executor), orchestrator };
}

const observation: ScreenObservation = {
  capturedAt: new Date().toISOString(),
  monitorId: "primary",
  activeWindowTitle: "VS Code",
  activeApplication: "Code"
};

test("proposal is queued for approval and does not execute immediately", async () => {
  const executed: unknown[] = [];
  const { controller, orchestrator } = makeController(executed);

  const result = await controller.proposeAndQueue(observation, { type: "click", x: 100, y: 200 });

  assert.ok(result.proposal);
  assert.equal((result.result.output as { status: string }).status, "approval_required");
  assert.equal(executed.length, 0);
  assert.equal(orchestrator.approvals.list().length, 1);
});

test("approved proposal resumes through the supervised executor", async () => {
  const executed: unknown[] = [];
  const { controller } = makeController(executed);

  const queued = await controller.proposeAndQueue(observation, { type: "keypress", key: "CTRL+S" });
  const actionId = String((queued.result.output as { actionId: string }).actionId);
  const resumed = await controller.approve(actionId);

  assert.equal(resumed.result.ok, true);
  assert.equal(resumed.result.approved, true);
  assert.equal(resumed.validation.status, "accepted");
  assert.equal(executed.length, 1);
});

test("privacy-filtered input is mandatory", async () => {
  const executed: unknown[] = [];
  const { controller } = makeController(executed);

  const result = await controller.proposeAndQueue({ ...observation, imageDataUrl: "data:image/png;base64,AAAA" }, { type: "click", x: 1, y: 2 });

  assert.equal(result.proposal, undefined);
  assert.equal(result.result.ok, false);
  assert.match(String((result.result.output as { error: string }).error), /privacy-filtered/);
  assert.equal(executed.length, 0);
});
