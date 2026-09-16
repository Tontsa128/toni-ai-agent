import assert from "node:assert/strict";
import test from "node:test";
import { ComputerActionLifecycle } from "../agent/computer/ComputerActionLifecycle.js";
import { ComputerActionResultValidator } from "../agent/computer/ComputerActionResultValidator.js";
import type { AuditEvent } from "../agent/audit/AuditLog.js";
import type { ScreenObservation } from "../agent/vision/ScreenObservation.js";
import type { ToolExecutionResult } from "../agent/providers/OpenAIToolLoop.js";

class MemoryAudit {
  readonly events: AuditEvent[] = [];
  append(event: Omit<AuditEvent, "eventId" | "timestamp">): AuditEvent {
    const saved = { ...event, eventId: `test-${this.events.length + 1}`, timestamp: new Date().toISOString() } as AuditEvent;
    this.events.push(saved);
    return saved;
  }
}

const observation: ScreenObservation = {
  capturedAt: new Date().toISOString(),
  monitorId: "primary",
  activeWindowTitle: "VS Code — toni-ai-agent",
  activeApplication: "Code",
  visibleText: "Build succeeded"
};

const execution: ToolExecutionResult = { ok: true, approved: true, output: { status: "clicked" } };

test("lifecycle records proposal, execution and confirmed verification", () => {
  const audit = new MemoryAudit();
  const lifecycle = new ComputerActionLifecycle(new ComputerActionResultValidator(), audit as never);
  const proposal = {
    actionId: "action-1",
    action: { type: "click", x: 10, y: 20 },
    observationCapturedAt: observation.capturedAt
  };

  lifecycle.recordProposal(proposal, "session-1");
  const executionValidation = lifecycle.recordExecution("session-1", "action-1", execution);
  const post = lifecycle.recordPostCondition("session-1", "action-1", observation, { visibleTextIncludes: ["build succeeded"] });

  assert.equal(executionValidation.status, "accepted");
  assert.equal(post.status, "confirmed");
  assert.deepEqual(audit.events.map((event) => event.type), [
    "computer_action_proposed",
    "computer_action_executed",
    "computer_action_verification_confirmed"
  ]);
});

test("lifecycle records inconclusive verification when OCR is unavailable", () => {
  const audit = new MemoryAudit();
  const lifecycle = new ComputerActionLifecycle(new ComputerActionResultValidator(), audit as never);
  const post = lifecycle.recordPostCondition("session-2", "action-2", { ...observation, visibleText: undefined }, { visibleTextIncludes: ["done"] });
  assert.equal(post.status, "inconclusive");
  assert.equal(audit.events.at(-1)?.type, "computer_action_verification_inconclusive");
});
