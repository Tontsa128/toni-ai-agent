import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { MemoryKind, MemoryRecord } from "./FileProjectMemory.js";

export interface EncryptedMemoryRecord extends MemoryRecord {}

/**
 * AES-256-GCM project memory. The encryption key is supplied by the host process
 * and is never persisted by this class. Do not pass keys through model messages.
 */
export class EncryptedProjectMemory {
  private readonly key: Buffer;

  constructor(private readonly root: string, keyMaterial = process.env.TONI_MEMORY_KEY) {
    if (!keyMaterial) throw new Error("TONI_MEMORY_KEY is not configured");
    this.key = Buffer.from(keyMaterial, "base64");
    if (this.key.length !== 32) throw new Error("TONI_MEMORY_KEY must decode to exactly 32 bytes");
  }

  private file(project: string): string {
    return path.join(this.root, `${project.replace(/[^a-zA-Z0-9._-]/g, "_")}.enc.jsonl`);
  }

  async save(record: EncryptedMemoryRecord): Promise<void> {
    if (/(api[_ -]?key|password|secret|token|cookie|mfa|otp)/i.test(record.summary)) {
      throw new Error("Potential secret blocked from memory");
    }
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(record), "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    await mkdir(this.root, { recursive: true });
    await appendFile(this.file(record.project), JSON.stringify({
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
      data: ciphertext.toString("base64")
    }) + "\n", "utf8");
  }

  async list(project: string): Promise<MemoryRecord[]> {
    try {
      const text = await readFile(this.file(project), "utf8");
      return text.split("\n").filter(Boolean).map((line) => this.decrypt(JSON.parse(line) as { iv: string; tag: string; data: string }));
    } catch {
      return [];
    }
  }

  async search(project: string, query: string): Promise<MemoryRecord[]> {
    const q = query.toLowerCase();
    return (await this.list(project)).filter((record) => `${record.summary} ${record.tags.join(" ")}`.toLowerCase().includes(q));
  }

  private decrypt(entry: { iv: string; tag: string; data: string }): MemoryRecord {
    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(entry.iv, "base64"));
    decipher.setAuthTag(Buffer.from(entry.tag, "base64"));
    const plain = Buffer.concat([decipher.update(Buffer.from(entry.data, "base64")), decipher.final()]);
    return JSON.parse(plain.toString("utf8")) as MemoryRecord;
  }
}

export type SafeMemoryKind = MemoryKind;
