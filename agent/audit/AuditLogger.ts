import { createHash } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export interface AuditEventInput {
  type: string;
  tool?: string;
  operation?: string;
  risk?: "green" | "yellow" | "red";
  approved?: boolean;
  outcome?: "proposed" | "approved" | "blocked" | "executed" | "failed" | "verified";
  metadata?: Record<string, unknown>;
}

interface StoredAuditEvent extends AuditEventInput {
  id: string;
  timestamp: string;
  previousHash: string;
  hash: string;
}

/** Append-only, hash-chained audit log. Secrets are scrubbed before persistence. */
export class AuditLogger {
  private lastHash = "GENESIS";

  constructor(private readonly root: string) {}

  async record(event: AuditEventInput): Promise<StoredAuditEvent> {
    const timestamp = new Date().toISOString();
    const safe = scrub(event);
    const body = JSON.stringify({ ...safe, timestamp, previousHash: this.lastHash });
    const hash = createHash("sha256").update(body).digest("hex");
    const stored: StoredAuditEvent = {
      ...safe,
      id: createHash("sha256").update(`${timestamp}:${hash}`).digest("hex").slice(0, 24),
      timestamp,
      previousHash: this.lastHash,
      hash
    };
    await mkdir(this.root, { recursive: true });
    await appendFile(path.join(this.root, "audit.jsonl"), JSON.stringify(stored) + "\n", "utf8");
    this.lastHash = hash;
    return stored;
  }
}

function scrub(value: AuditEventInput): AuditEventInput {
  const json = JSON.stringify(value)
    .replace(/(api[_ -]?key|password|secret|token|cookie|mfa|otp)\s*[:=]\s*[^,}\]]+/gi, "$1:[REDACTED]");
  return JSON.parse(json) as AuditEventInput;
}
