import { redactSecrets } from "../../agent/audit/Redactor.js";

export type LogLevel = "debug" | "info" | "warn" | "error";
export interface LogFields {
  requestId?: string; sessionId?: string; userId?: string; toolName?: string;
  actionId?: string; durationMs?: number; errorCode?: string; [key: string]: unknown;
}
export class Logger {
  public constructor(private readonly minimumLevel: LogLevel = "info") {}
  public debug(message: string, fields: LogFields = {}): void { this.write("debug", message, fields); }
  public info(message: string, fields: LogFields = {}): void { this.write("info", message, fields); }
  public warn(message: string, fields: LogFields = {}): void { this.write("warn", message, fields); }
  public error(message: string, fields: LogFields = {}): void { this.write("error", message, fields); }
  private write(level: LogLevel, message: string, fields: LogFields): void {
    if (weight(level) < weight(this.minimumLevel)) return;
    const safe: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (/key|token|secret|password|cookie|authorization|prompt/i.test(key)) safe[key] = "[REDACTED]";
      else if (typeof value === "string") safe[key] = redactSecrets(value);
      else safe[key] = value;
    }
    const output = JSON.stringify({ timestamp: new Date().toISOString(), level, message: redactSecrets(message), ...safe });
    if (level === "error") console.error(output); else console.log(output);
  }
}
function weight(level: LogLevel): number { return { debug: 10, info: 20, warn: 30, error: 40 }[level]; }
