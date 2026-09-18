import { randomUUID } from "node:crypto";
import type { AgentContext, AgentAction } from "../types.js";
import type { ToolInvocation } from "../sandbox/types.js";
import { AgentOrchestrator } from "../core/AgentOrchestrator.js";
import { ApprovalStore, type ApprovalRecord } from "../approvals/ApprovalStore.js";
import { AuditLog } from "../audit/AuditLog.js";
import { AgentError } from "../errors/AgentError.js";
import { CancellationRegistry } from "../core/CancellationRegistry.js";
import { SessionLock } from "../core/SessionLock.js";
import { SafeToolExecutor, type SafeToolExecutionResult } from "../tools/SafeToolExecutor.js";
import { ToolRegistry } from "../tools/ToolRegistry.js";
import { hashToolCall } from "../security/ToolCallHash.js";
import { createApproval, type ApprovalStoreWriter } from "./ApprovalToken.js";
import { decideToolPermission } from "./ToolPermission.js";

export interface SupervisedToolRequest {
  sessionId: string;
  actionId: string;
  approvalId?: string;
  toolName: string;
  input: unknown;
  signal: AbortSignal;
}

export interface SupervisedToolResult extends SafeToolExecutionResult {
  executed: boolean;
  approved: boolean;
  actionId: string;
  approvalId?: string;
}

interface PendingExecution {
  request: SupervisedToolRequest;
  approvalId: string;
}

export interface AuditSink {
  append(event: {
    type:
      | "approval_requested"
      | "approval_consumed"
      | "approval_expired"
      | "tool_allowed"
      | "tool_denied"
      | "tool_executed"
      | "tool_execution_failed";
    sessionId: string;
    actionId: string;
    summary?: string;
    reason?: string;
  }): unknown;
}

export class SupervisedToolExecutor {
  private readonly lock = new SessionLock();
  private readonly cancellation = new CancellationRegistry();
  private readonly pending = new Map<string, PendingExecution>();

  public constructor(
    private readonly registry: ToolRegistry,
    private readonly executor: SafeToolExecutor,
    private readonly approvals: ApprovalStoreWriter,
    private readonly audit: AuditSink,
    private readonly orchestrator: AgentOrchestrator,
    private readonly context: AgentContext
  ) {}

  public async execute(request: SupervisedToolRequest): Promise<SupervisedToolResult> {
    return this.lock.runExclusive(async () => this.executeUnlocked(request));
  }

  public async approveAndResume(actionId: string): Promise<SupervisedToolResult> {
    const pending = this.pending.get(actionId);
    if (!pending) throw new Error(`No pending tool call for approval action ${actionId}`);

    const approval = this.orchestrator.approvals.approve(actionId);
    if (approval.approved !== true) throw new Error("Approval was not granted.");

    this.pending.delete(actionId);
    return this.execute({
      ...pending.request,
      approvalId: pending.approvalId
    });
  }

  public reject(actionId: string): void {
    this.orchestrator.approvals.reject(actionId);
    this.pending.delete(actionId);
  }

  public cancel(operationId: string): boolean {
    return this.cancellation.cancel(operationId);
  }

  public isBusy(): boolean {
    return this.lock.isActive();
  }

  public listPendingActionIds(): string[] {
    return [...this.pending.keys()];
  }

  private async executeUnlocked(request: SupervisedToolRequest): Promise<SupervisedToolResult> {
    if (request.signal.aborted) {
      throw new AgentError("CANCELLED", "Tool execution was cancelled.", false);
    }

    const tool = this.registry.get(request.toolName);
    const argumentHash = hashToolCall(request.toolName, request.input);
    const candidate = request.approvalId ? await this.getApproval(request.approvalId) : undefined;
    const hasValidApproval = candidate !== undefined
      && candidate.sessionId === request.sessionId
      && candidate.actionId === request.actionId
      && candidate.argumentHash === argumentHash;

    if (request.approvalId && !hasValidApproval) {
      this.audit.append({
        type: "approval_expired",
        sessionId: request.sessionId,
        actionId: request.actionId,
        reason: "Approval is invalid, expired, reused, or does not match the requested action."
      });
      throw new AgentError("APPROVAL_EXPIRED", "Approval is invalid or expired.", false);
    }

    const invocation: ToolInvocation = {
      tool: request.toolName,
      operation: "execute",
      input: request.input,
      risk: tool.risk
    };
    const supervised = this.orchestrator.supervisor.inspect(invocation);
    const action: AgentAction = this.orchestrator.permissions.evaluate(
      {
        ...supervised,
        id: request.actionId,
        createdAt: new Date().toISOString()
      },
      this.context,
      request.input
    );

    const permission = decideToolPermission({
      sessionId: request.sessionId,
      toolName: request.toolName,
      risk: action.risk,
      argumentHash,
      hasValidApproval
    });

    if (permission.decision === "approval_required") {
      if (action.risk === "yellow" && !request.approvalId) {
        const created = await createApproval(
          this.approvals,
          request.sessionId,
          request.actionId,
          request.toolName,
          request.input
        );
        this.pending.set(request.actionId, { request, approvalId: created.approvalId });
        this.orchestrator.approvals.request({
          action,
          reason: permission.reason
        });
        this.audit.append({
          type: "approval_requested",
          sessionId: request.sessionId,
          actionId: request.actionId,
          summary: "Human approval required for yellow-risk tool execution."
        });
        return {
          toolName: request.toolName,
          argumentHash,
          output: {
            status: "approval_required",
            actionId: request.actionId,
            approvalId: created.approvalId,
            description: action.description,
            risk: action.risk
          },
          executed: false,
          approved: false,
          actionId: request.actionId,
          approvalId: created.approvalId
        };
      }

      this.audit.append({
        type: "tool_denied",
        sessionId: request.sessionId,
        actionId: request.actionId,
        reason: permission.reason
      });
      throw new AgentError("APPROVAL_REQUIRED", permission.reason, false);
    }

    if (permission.decision === "deny") {
      this.audit.append({
        type: "tool_denied",
        sessionId: request.sessionId,
        actionId: request.actionId,
        reason: permission.reason
      });
      throw new AgentError("PERMISSION_DENIED", permission.reason, false);
    }

    if (request.approvalId && hasValidApproval) {
      try {
        await this.approvals.consume(
          request.approvalId,
          request.sessionId,
          request.actionId,
          argumentHash
        );
        this.audit.append({
          type: "approval_consumed",
          sessionId: request.sessionId,
          actionId: request.actionId,
          summary: "Approval consumed immediately before tool execution."
        });
      } catch (error: unknown) {
        this.audit.append({
          type: "approval_expired",
          sessionId: request.sessionId,
          actionId: request.actionId,
          reason: "Approval could not be consumed."
        });
        throw new AgentError("APPROVAL_EXPIRED", "Approval is invalid or expired.", false, { cause: error });
      }
    }

    const operationId = request.actionId;
    const controller = this.cancellation.create(operationId);
    const signal = AbortSignal.any([request.signal, controller]);
    try {
      this.audit.append({
        type: "tool_allowed",
        sessionId: request.sessionId,
        actionId: request.actionId,
        summary: permission.reason
      });
      const result = await this.executor.execute(
        request.toolName,
        request.input,
        { sessionId: request.sessionId, signal }
      );
      if (signal.aborted) throw new AgentError("CANCELLED", "Tool execution was cancelled.", false);
      this.audit.append({
        type: "tool_executed",
        sessionId: request.sessionId,
        actionId: request.actionId,
        summary: "Tool execution completed successfully."
      });
      return {
        ...result,
        executed: true,
        approved: true,
        actionId: request.actionId
      };
    } catch (error: unknown) {
      this.audit.append({
        type: "tool_execution_failed",
        sessionId: request.sessionId,
        actionId: request.actionId,
        reason: error instanceof Error ? error.message : String(error)
      });
      throw error;
    } finally {
      this.cancellation.remove(operationId);
    }
  }

  private async getApproval(approvalId: string): Promise<ApprovalRecord | undefined> {
    if (this.approvals instanceof ApprovalStore) {
      return this.approvals.get(approvalId);
    }
    return undefined;
  }
}
