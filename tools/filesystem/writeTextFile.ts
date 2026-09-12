import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export async function writeTextFile(workspace: string, relativePath: string, content: string): Promise<{ path: string; bytes: number }> {
  const root = resolve(workspace);
  const target = resolve(root, relativePath);
  if (target !== root && !target.startsWith(`${root}/`) && !target.startsWith(`${root}\\`)) {
    throw new Error("Path escapes workspace");
  }
  if (typeof content !== "string") throw new Error("content must be a string");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
  return { path: target, bytes: Buffer.byteLength(content, "utf8") };
}
