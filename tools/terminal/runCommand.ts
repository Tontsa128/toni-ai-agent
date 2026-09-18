import { TerminalExecutor } from "../../agent/sandbox/TerminalExecutor.js";

const SAFE = new Set(["git status", "git diff", "git log", "npm test", "npm run check", "npm run build"]);

export function isSafeCommand(command: string): boolean {
  return SAFE.has(command.trim());
}

export async function runCommand(command: string, cwd: string): Promise<{ code: number; stdout: string; stderr: string }> {
  if (!isSafeCommand(command)) throw new Error(`Command requires approval: ${command}`);
  const executor = new TerminalExecutor({
    policy: {
      workspaceRoot: cwd,
      network: "deny",
      maxExecutionMs: 30_000,
      maxOutputBytes: 200_000,
      allowCommands: ["git", "npm"],
      denyPatterns: ["rm -rf", "shutdown", "reboot", "format", "del /s /q"]
    }
  });
  const result = await executor.run({ command, cwd });
  return { code: result.exitCode ?? -1, stdout: result.stdout, stderr: result.stderr || result.reason || "" };
}
