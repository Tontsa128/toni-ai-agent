import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

export type MemoryKind = "decision" | "error" | "progress" | "constraint" | "file" | "build" | "test";
export interface MemoryRecord { id: string; createdAt: string; project: string; kind: MemoryKind; summary: string; tags: string[]; }

export class FileProjectMemory {
  constructor(private readonly root: string) {}
  private file(project: string): string { return path.join(this.root, `${project.replace(/[^a-zA-Z0-9._-]/g, "_")}.jsonl`); }
  async save(record: MemoryRecord): Promise<void> {
    if (/(api[_ -]?key|password|secret|token|cookie|mfa)/i.test(record.summary)) throw new Error("Potential secret blocked from memory");
    await mkdir(this.root, { recursive: true });
    await appendFile(this.file(record.project), JSON.stringify(record) + "\n", "utf8");
  }
  async list(project: string): Promise<MemoryRecord[]> {
    try { const text = await readFile(this.file(project), "utf8"); return text.split("\n").filter(Boolean).map((line) => JSON.parse(line) as MemoryRecord); }
    catch { return []; }
  }
  async search(project: string, query: string): Promise<MemoryRecord[]> {
    const q = query.toLowerCase();
    return (await this.list(project)).filter((record) => `${record.summary} ${record.tags.join(" ")}`.toLowerCase().includes(q));
  }
}
