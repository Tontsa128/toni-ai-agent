import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { PermissionPolicy } from "../agent/core/PermissionEngine.js";

export async function loadPolicy(workspace: string): Promise<PermissionPolicy> {
  const path = resolve(workspace, "config/permissions.json");
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as PermissionPolicy;
}
