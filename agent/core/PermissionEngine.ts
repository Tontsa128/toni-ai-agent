import type { AgentAction, AgentContext, ActionRisk } from "../types.js";

export interface PermissionPolicy {
  filesystem: { read: string; write: string; delete: string };
  terminal: { safe_commands: string; unknown_commands: string; destructive_commands: string };
  git: { read: string; commit: string; push: string };
  browser: { read: string; write: string; submit: string };
  system: { settings: string; administrator: string };
  school: Record<string, string>;
}

const GREEN = new Set(["read", "analyse", "draft", "workspace", "allow"]);
const RED_OPERATIONS = new Set([
  "submit_assignment",
  "send_message",
  "send_email",
  "production_deploy",
  "system_settings",
  "administrator",
  "use_secret"
]);

export class PermissionEngine {
  constructor(private readonly policy: PermissionPolicy) {}

  evaluate(action: AgentAction, context: AgentContext): AgentAction {
    const risk = this.calculateRisk(action, context);
    return {
      ...action,
      risk,
      requiresApproval: risk !== "green"
    };
  }

  private calculateRisk(action: AgentAction, context: AgentContext): ActionRisk {
    if (RED_OPERATIONS.has(action.operation)) return "red";
    if (action.operation.includes("delete") || action.operation.includes("push")) return "yellow";
    if (action.tool === "browser" && ["write", "submit", "send"].some((x) => action.operation.includes(x))) return "yellow";
    if (context.mode === "school" && action.operation.includes("school")) return "yellow";
    if (GREEN.has(action.operation) || action.risk === "green") return "green";
    return action.risk === "red" ? "red" : "yellow";
  }
}
