import { randomUUID } from "node:crypto";
import type { AgentContext } from "../types.js";
import type { ToolInvocation } from "../sandbox/types.js";
import { AgentOrchestrator } from "./AgentOrchestrator.js";
import { CancellationRegistry } from "./CancellationRegistry.js";
import { SessionLock } from "./SessionLock.js";
import { SessionBudget } from "../limits/SessionBudget.js";
import { SafeToolExecutor } from "../tools/SafeToolExecutor.js";
import { ToolRegistry } from "../tools/ToolRegistry.js";
import { AuditLog } from "../audit/AuditLog.js";
import { ApprovalStore } from "../approvals/ApprovalStore.js";
import { SupervisedToolExecutor as IntegratedSupervisedToolExecutor, type SupervisedToolRequest } from "../supervisor/SupervisedToolExecutor.js";
import type { ToolExecutionContext, ToolExecutionResult } from "../providers/OpenAIToolLoop.js";

export class SupervisedToolExecutor {
  readonly continuations: { listActionIds: () => string[] };
  private readonly sessionId = randomUUID();
  private readonly integrated: IntegratedSupervisedToolExecutor;

  constructor(
    private readonly orchestrator: AgentOrchestrator,
    registry: ToolRegistry,
    private readonly context: AgentContext,
    approvals?: ApprovalStore,
    audit?: AuditLog,
    maxToolCalls = 8
  ) {
    const approvalStore = approvals ?? new ApprovalStoreCompat();
    const auditLog = audit ?? new NoopAuditLog();
    const safeExecutor = new SafeToolExecutor(registry, new SessionBudget(maxToolCalls));
    this.integrated = new IntegratedSupervisedToolExecutor(
      registry,
      safeExecutor,
      approvalStore,
      auditLog,
      orchestrator,
      context
    );
    this.continuations = { listActionIds: () => this.integrated.listPendingActionIds() };
  }

  async execute(input: ToolExecutionContext): Promise<ToolExecutionResult> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(input.argumentsJson);
    } catch {
      return { ok: false, approved: false, output: { error: "Tool arguments were not valid JSON" } };
    }

    try {
      const result = await this.integrated.execute({
        sessionId: this.sessionId,
        actionId: randomUUID(),
        toolName: input.name,
        input: parsed,
        signal: new AbortController().signal
      });
      return {
        ok: result.executed,
        approved: result.approved,
        output: result.output,
        operationId: result.actionId
      };
    } catch (error: unknown) {
      return {
        ok: false,
        approved: false,
        output: { error: error instanceof Error ? error.message : String(error) },
        operationId: input.callId
      };
    }
  }

  async approveAndResume(actionId: string): Promise<ToolExecutionResult> {
    try {
      const result = await this.integrated.approveAndResume(actionId);
      return {
        ok: result.executed,
        approved: result.approved,
        output: result.output,
        operationId: result.actionId
      };
    } catch (error: unknown) {
      return { ok: false, approved: false, output: { error: error instanceof Error ? error.message : String(error) } };
    }
  }

  reject(actionId: string): void {
    this.integrated.reject(actionId);
  }

  cancel(operationId: string): boolean {
    return this.integrated.cancel(operationId);
  }

  isBusy(): boolean {
    return this.integrated.isBusy();
  }
}

class ApprovalStoreCompat implements import("../supervisor/ApprovalToken.js").ApprovalStoreWriter {
  private readonly records = new Map<string, import("../approvals/ApprovalStore.js").ApprovalRecord>();
  async put(input: Omit<import("../approvals/ApprovalStore.js").ApprovalRecord, "createdAt" | "expiresAt" | "used">) {
    const now = Date.now();
    const record = { ...input, createdAt: now, expiresAt: now + 120_000, used: false };
    this.records.set(record.approvalId, record);
    return record;
  }
  get(id: string) { const record = this.records.get(id); return record && !record.used && record.expiresAt > Date.now() ? { ...record } : undefined; }
  async consume(id: string, sessionId: string, actionId: string, argumentHash: string) {
    const record = this.get(id);
    if (!record || record.sessionId !== sessionId || record.actionId !== actionId || record.argumentHash !== argumentHash) throw new Error("Approval is invalid.");
    record.used = true;
    this.records.set(id, record);
    return record;
  }
}

class NoopAuditLog implements import("../supervisor/SupervisedToolExecutor.js").AuditSink {
  append(_event: Parameters<import("../supervisor/SupervisedToolExecutor.js").AuditSink["append"]>[0]): void {}
}
