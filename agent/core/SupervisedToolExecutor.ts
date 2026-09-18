import { randomUUID } from "node:crypto";
import type { AgentContext } from "../types.js";
import type { ToolInvocation } from "../sandbox/types.js";
import { ToolRegistry } from "../tools/ToolRegistry.js";
import { AgentOrchestrator } from "./AgentOrchestrator.js";
import { ApprovalContinuation } from "./ApprovalContinuation.js";
import { CancellationRegistry } from "./CancellationRegistry.js";
import { SessionLock } from "./SessionLock.js";
import { SessionBudget } from "../limits/SessionBudget.js";
import { SafeToolExecutor } from "../tools/SafeToolExecutor.js";
import type { ToolExecutionContext, ToolExecutionResult } from "../providers/OpenAIToolLoop.js";

export class SupervisedToolExecutor {
  readonly continuations: ApprovalContinuation;
  private readonly cancellation = new CancellationRegistry();
  private readonly lock = new SessionLock();
  private readonly safeExecutor: SafeToolExecutor;
  private readonly sessionId = randomUUID();

  constructor(
    private readonly orchestrator: AgentOrchestrator,
    private readonly registry: ToolRegistry,
    private readonly context: AgentContext,
    maxToolCalls = 8
  ) {
    this.continuations = new ApprovalContinuation(orchestrator);
    this.safeExecutor = new SafeToolExecutor(registry, new SessionBudget(maxToolCalls));
  }

  async execute(input: ToolExecutionContext): Promise<ToolExecutionResult> {
    const tool = this.registry.get(input.name);
    let parsed: unknown;
    try { parsed = JSON.parse(input.argumentsJson); }
    catch { return { ok: false, approved: false, output: { error: "Tool arguments were not valid JSON" } }; }

    if (this.cancellation.has(input.callId)) {
      return { ok: false, approved: false, output: { error: "Tool execution was cancelled." } };
    }

    const invocation: ToolInvocation = { tool: input.name, operation: "execute", input: parsed, risk: tool.risk };
    const action = this.orchestrator.authorize(this.context, invocation);
    if (action.requiresApproval) {
      this.continuations.hold(action.id, this.context, input);
      return { ok: false, approved: false, output: { status: "approval_required", actionId: action.id, description: action.description, risk: action.risk } };
    }

    return this.lock.runExclusive(async () => this.executeWithCancellation(input.name, parsed, input.callId, true));
  }

  async approveAndResume(actionId: string): Promise<ToolExecutionResult> {
    return this.continuations.approveAndResume(actionId, async (call) =>
      this.lock.runExclusive(async () => this.executeWithCancellation(call.name, JSON.parse(call.argumentsJson), call.callId, true))
    );
  }

  reject(actionId: string): void { this.continuations.reject(actionId); }

  cancel(operationId: string): boolean { return this.cancellation.cancel(operationId); }

  isBusy(): boolean { return this.lock.isActive(); }

  private async executeWithCancellation(name: string, input: unknown, callId: string, approved: boolean): Promise<ToolExecutionResult> {
    const operationId = callId;
    const signal = this.cancellation.create(operationId);
    try {
      const result = await this.safeExecutor.execute(name, input, { sessionId: this.sessionId, signal });
      return { ok: true, approved, output: result.output, operationId };
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AgentError" && "code" in error && (error as { code?: unknown }).code === "CANCELLED") {
        return { ok: false, approved, output: { error: "Tool execution was cancelled." }, operationId };
      }
      return { ok: false, approved, output: { error: error instanceof Error ? error.message : String(error) }, operationId };
    } finally {
      this.cancellation.remove(operationId);
    }
  }
}
