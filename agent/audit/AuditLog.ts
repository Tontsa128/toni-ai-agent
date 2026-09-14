import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const MAX_TEXT = 1000;

export type AuditEventType =
  | "repair_started"
  | "repair_approval_requested"
  | "repair_approved"
  | "repair_rejected"
  | "repair_succeeded"
  | "repair_failed";

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

/** Small append-only audit sink. It records decisions/results, never raw model or command output. */
export class AuditLog {
  constructor(private readonly options: AuditLogOptions) {}

  append(event: Omit<AuditEvent, "eventId" | "timestamp">): AuditEvent {
    const sanitized: AuditEvent = {
      eventId: cryptoRandomId(),
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

function cryptoRandomId(): string {
  const random = Math.random().toString(36).slice(2);
  return `audit-${Date.now().toString(36)}-${random}`;
}
