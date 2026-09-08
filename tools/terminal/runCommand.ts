import { spawn } from "node:child_process";

const SAFE = new Set(["git status", "git diff", "git log", "npm test", "npm run check", "npm run build"]);

export function isSafeCommand(command: string): boolean {
  return SAFE.has(command.trim());
}

export function runCommand(command: string, cwd: string): Promise<{ code: number; stdout: string; stderr: string }> {
  if (!isSafeCommand(command)) throw new Error(`Command requires approval: ${command}`);
  return new Promise((resolve, reject) => {
    const child = spawn(command, { cwd, shell: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}
