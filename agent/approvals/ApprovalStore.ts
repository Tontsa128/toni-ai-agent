import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export interface ApprovalRecord {
  approvalId: string;
  sessionId: string;
  actionId: string;
  argumentHash: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
  userId?: string;
  toolName?: string;
}

export class ApprovalStore {
  private readonly records = new Map<string, ApprovalRecord>();
  private loaded = false;

  constructor(
    private readonly filePath: string,
    private readonly ttlMs: number,
    private readonly now: () => number = () => Date.now(),
  ) {
    if (!Number.isInteger(ttlMs) || ttlMs < 1_000) {
      throw new Error("Approval TTL must be at least 1000 ms.");
    }
  }

  async init(): Promise<void> {
    if (this.loaded) return;
    await mkdir(dirname(this.filePath), { recursive: true });
    try {
      const content = await readFile(this.filePath, "utf8");
      const parsed: unknown = JSON.parse(content);
      if (!Array.isArray(parsed)) throw new Error("Approval store must contain an array.");
      for (const value of parsed) {
        const record = parseApprovalRecord(value);
        if (record.expiresAt > this.now() && !record.used) this.records.set(record.approvalId, record);
      }
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === "ENOENT") {
        // First startup: an empty store is valid.
      } else {
        throw error;
      }
    }
    this.loaded = true;
    await this.persist();
  }

  async put(input: Omit<ApprovalRecord, "createdAt" | "expiresAt" | "used">): Promise<ApprovalRecord> {
    this.ensureLoaded();
    const createdAt = this.now();
    const record: ApprovalRecord = { ...input, createdAt, expiresAt: createdAt + this.ttlMs, used: false };
    this.records.set(record.approvalId, record);
    await this.persist();
    return record;
  }

  async consume(approvalId: string, sessionId: string, actionId: string, argumentHash: string): Promise<ApprovalRecord> {
    this.ensureLoaded();
    const record = this.records.get(approvalId);
    if (!record) throw new Error("Approval was not found.");
    if (record.used) throw new Error("Approval has already been used.");
    if (record.expiresAt <= this.now()) {
      this.records.delete(approvalId);
      await this.persist();
      throw new Error("Approval has expired.");
    }
    if (record.sessionId !== sessionId || record.actionId !== actionId || record.argumentHash !== argumentHash) {
      throw new Error("Approval does not match the requested action.");
    }
    record.used = true;
    await this.persist();
    return record;
  }

  async consumeVerified(approvalId: string, sessionId: string, actionId: string, argumentHash: string): Promise<void> {
    await this.consume(approvalId, sessionId, actionId, argumentHash);
  }

  get(approvalId: string): ApprovalRecord | undefined {
    this.ensureLoaded();
    const record = this.records.get(approvalId);
    if (!record) return undefined;
    if (record.used || record.expiresAt <= this.now()) {
      return undefined;
    }
    return { ...record };
  }

  size(): number {
    this.ensureLoaded();
    return this.records.size;
  }

  private ensureLoaded(): void {
    if (!this.loaded) throw new Error("ApprovalStore.init() must be called before use.");
  }

  private async persist(): Promise<void> {
    const temporaryPath = `${this.filePath}.tmp`;
    await writeFile(temporaryPath, JSON.stringify([...this.records.values()], null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporaryPath, this.filePath);
  }
}

function parseApprovalRecord(value: unknown): ApprovalRecord {
  if (typeof value !== "object" || value === null) throw new Error("Invalid approval record.");
  const record = value as Record<string, unknown>;
  if (
    typeof record.approvalId !== "string" ||
    typeof record.sessionId !== "string" ||
    typeof record.actionId !== "string" ||
    typeof record.argumentHash !== "string" ||
    typeof record.createdAt !== "number" ||
    typeof record.expiresAt !== "number" ||
    typeof record.used !== "boolean"
  ) throw new Error("Invalid approval record fields.");
  return record as unknown as ApprovalRecord;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
