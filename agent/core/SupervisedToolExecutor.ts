import { randomUUID } from "node:crypto";
import type { AgentContext } from "../types.js";
import { AgentOrchestrator } from "./AgentOrchestrator.js";
import { SessionBudget } from "../limits/SessionBudget.js";
import { SafeToolExecutor } from "../tools/SafeToolExecutor.js";
import { ToolRegistry } from "../tools/ToolRegistry.js";
import {
  SupervisedToolExecutor as IntegratedSupervisedToolExecutor,
  type AuditSink,
  type ApprovalStorePort
} from "../supervisor/SupervisedToolExecutor.js";
import type { ToolExecutionContext, ToolExecutionResult } from "../providers/OpenAIToolLoop.js";
import { Logger } from "../../app/observability/Logger.js";
import { Metrics } from "../../app/observability/Metrics.js";

export class SupervisedToolExecutor {
  readonly continuations: { listActionIds: () => string[] };
  private readonly sessionId = randomUUID();
  private readonly integrated: IntegratedSupervisedToolExecutor;

  constructor(
    private readonly orchestrator: AgentOrchestrator,
    registry: ToolRegistry,
    private readonly context: AgentContext,
    approvals?: ApprovalStorePort,
    audit?: AuditSink,
    maxToolCalls = 8,
    logger?: Logger,
    metrics?: Metrics
  ) {
    const approvalStore: ApprovalStorePort = approvals ?? new ApprovalStoreCompat();
    const auditLog: AuditSink = audit ?? new NoopAuditLog();
    const safeExecutor = new SafeToolExecutor(registry, new SessionBudget(maxToolCalls), logger, metrics);
    this.integrated = new IntegratedSupervisedToolExecutor(
      registry,
      safeExecutor,
      approvalStore,
      auditLog,
      orchestrator,
      context,
      logger,
      metrics
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
        signal: new AbortController().signal,
        requestId: input.requestId
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

class ApprovalStoreCompat implements ApprovalStorePort {
  private readonly records = new Map<string, import("../../storage/repositories/ApprovalRepository.js").ApprovalRecord>();

  async put(input: {approvalId:string;userId:string;sessionId:string;actionId:string;toolName:string;argumentHash:string}) {
    const now = Date.now();
    const record = { ...input, createdAt: now, expiresAt: now + 120_000, used: false };
    this.records.set(record.approvalId, record);
    return record;
  }

  get(id: string) {
    const record = this.records.get(id);
    return record && !record.used && record.expiresAt > Date.now() ? { ...record } : undefined;
  }

  async consume(id: string, sessionId: string, actionId: string, argumentHash: string, userId: string, toolName: string) {
    const record = this.get(id);
    if (!record || record.userId !== userId || record.sessionId !== sessionId || record.actionId !== actionId || record.toolName !== toolName || record.argumentHash !== argumentHash) {
      throw new Error("Approval is invalid.");
    }
    record.used = true;
    this.records.set(id, record);
    return record;
  }
}

class NoopAuditLog implements AuditSink {
  append(_event: Parameters<AuditSink["append"]>[0]): void {}
}
