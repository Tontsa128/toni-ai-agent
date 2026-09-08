export type RiskLevel = "green" | "yellow" | "red";
export interface SandboxPolicy { workspaceRoot: string; network: "deny" | "allow"; maxExecutionMs: number; maxOutputBytes: number; allowCommands: string[]; denyPatterns: string[]; }
export interface ExecutionRequest { command: string; cwd: string; env?: Record<string, string>; }
export interface ExecutionResult { ok: boolean; exitCode: number | null; stdout: string; stderr: string; durationMs: number; blocked: boolean; reason?: string; }
export interface ToolInvocation { tool: string; operation: string; input: unknown; risk: RiskLevel; }
export interface AuditEvent { id: string; timestamp: string; type: string; tool?: string; operation?: string; risk?: RiskLevel; approved?: boolean; metadata?: Record<string, unknown>; }
