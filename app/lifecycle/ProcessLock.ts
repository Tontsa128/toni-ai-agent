import { open, readFile, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { mkdir } from "node:fs/promises";

export class ProcessLock {
  private constructor(private readonly handle: Awaited<ReturnType<typeof open>>, private readonly path: string) {}

  static async acquire(path: string): Promise<ProcessLock> {
    await mkdir(dirname(path), { recursive: true });
    try {
      const handle = await open(path, "wx");
      await handle.writeFile(JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
      return new ProcessLock(handle, path);
    } catch (error: unknown) {
      const existing = await readExisting(path);
      if (existing?.pid && existing.pid !== process.pid && isProcessAlive(existing.pid)) {
        throw new Error(`Another Toni AI Agent process is already running (pid ${existing.pid}).`);
      }
      await rm(path, { force: true });
      const handle = await open(path, "wx");
      await handle.writeFile(JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
      return new ProcessLock(handle, path);
    }
  }

  async release(): Promise<void> {
    try { await this.handle.close(); } finally { await rm(this.path, { force: true }); }
  }
}

async function readExisting(path: string): Promise<{ pid?: number } | undefined> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && typeof (parsed as { pid?: unknown }).pid === "number") {
      return { pid: (parsed as { pid: number }).pid };
    }
  } catch {}
  return undefined;
}

function isProcessAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch { return false; }
}
