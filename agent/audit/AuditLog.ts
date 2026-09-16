import { appendFileSync, chmodSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";

const MAX_TEXT = 1000;

export type AuditEventType =
  | "repair_started"
  | "repair_approval_requested"
  | "repair_approved"
  | "repair_rejected"
  | "repair_succeeded"
  | "repair_failed"
  | "computer_action_proposed"
  | "computer_action_approval_requested"
  | "computer_action_approved"
  | "computer_action_rejected"
  | "computer_action_executed"
  | "computer_action_execution_failed"
  | "computer_action_verification_confirmed"
  | "computer_action_verification_failed"
  | "computer_action_verification_inconclusive";

export interface AuditEvent {
  eventId: string;
  timestamp: string;
  type: AuditEventType;
  sessionId: string;
  attempt?: number;
  actionId?: string;
  summary?: string;
  reason?: string;
}

export interface AuditLogOptions { filePath: string; }

/** Append-only audit sink for repair and supervised computer-action lifecycle events. */
export class AuditLog {
  constructor(private readonly options: AuditLogOptions) {}

  append(event: Omit<AuditEvent, "eventId" | "timestamp">): AuditEvent {
    const sanitized: AuditEvent = {
      eventId: randomUUID(),
      timestamp: new Date().toISOString(),
      type: event.type,
      sessionId: this.safeText(event.sessionId)
    };
    if (event.attempt !== undefined) sanitized.attempt = event.attempt;
    if (event.actionId !== undefined) sanitized.actionId = this.safeText(event.actionId);
    if (event.summary !== undefined) sanitized.summary = this.safeText(event.summary);
    if (event.reason !== undefined) sanitized.reason = this.safeText(event.reason);

    mkdirSync(dirname(this.options.filePath), { recursive: true });
    appendFileSync(this.options.filePath, `${JSON.stringify(sanitized)}\n`, { encoding: "utf8", mode: 0o600 });
    chmodSync(this.options.filePath, 0o600);
    return sanitized;
  }

  private safeText(value: string): string {
    return value
      .replace(/(?:sk|pk)_(?:live|test)_[A-Za-z0-9_-]+/gi, "[REDACTED]")
      .replace(/((?:api[_-]?key|token|password|secret|authorization))\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
      .replace(/bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
      .slice(0, MAX_TEXT);
  }
}
