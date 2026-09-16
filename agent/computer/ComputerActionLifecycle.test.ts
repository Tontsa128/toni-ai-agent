import { describe, expect, it, vi } from "vitest";
import { ComputerActionLifecycle } from "./ComputerActionLifecycle.js";

function observation() {
  return {
    capturedAt: new Date().toISOString(),
    monitorId: "virtual-screen",
    activeWindowTitle: "Test Window",
    activeApplication: "test-app",
    visibleText: "Saved successfully"
  };
}

describe("ComputerActionLifecycle", () => {
  it("records proposal and execution validation without executing the action", () => {
    const audit = { append: vi.fn() };
    const validator = { validate: vi.fn().mockReturnValue({ status: "accepted", reason: "ok" }) };
    const lifecycle = new ComputerActionLifecycle(validator as never, audit as never);
    const proposal = { action: { type: "click", x: 10, y: 20 }, observationCapturedAt: observation().capturedAt };

    lifecycle.recordProposal(proposal, "session-1");
    const result = lifecycle.recordExecution("session-1", "action-1", { ok: true, approved: true, output: { ok: true } });

    expect(result.status).toBe("accepted");
    expect(validator.validate).toHaveBeenCalledOnce();
    expect(audit.append).toHaveBeenCalledTimes(2);
  });

  it("maps post-condition outcomes to audit events", () => {
    const audit = { append: vi.fn() };
    const validator = {
      validate: vi.fn(),
      validatePostCondition: vi.fn().mockReturnValue({ status: "confirmed", reason: "matched" })
    };
    const lifecycle = new ComputerActionLifecycle(validator as never, audit as never);

    const result = lifecycle.recordPostCondition("session-2", "action-2", observation(), { visibleTextIncludes: ["saved"] });

    expect(result.status).toBe("confirmed");
    expect(audit.append).toHaveBeenLastCalledWith(expect.objectContaining({
      type: "computer_action_verification_confirmed",
      actionId: "action-2"
    }));
  });
});
