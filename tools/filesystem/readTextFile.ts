import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export async function readTextFile(workspace: string, relativePath: string): Promise<string> {
  const root = resolve(workspace);
  const target = resolve(root, relativePath);
  if (!target.startsWith(root)) throw new Error("Path escapes workspace");
  return readFile(target, "utf8");
}
