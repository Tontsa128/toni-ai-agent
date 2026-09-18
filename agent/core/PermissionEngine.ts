import type { AgentAction, AgentContext, ActionRisk } from "../types.js";

export interface PermissionPolicy {
  filesystem: { read: string; write: string; delete: string };
  terminal: { safe_commands: string; unknown_commands: string; destructive_commands: string };
  git: { read: string; commit: string; push: string; reset?: string };
  github?: { read: string; write: string; merge: string; delete: string };
  browser: { read: string; write: string; submit: string; download?: string };
  computer?: { read: string; click: string; type: string; system: string };
  system: { settings: string; administrator: string; shutdown?: string };
  school: Record<string, string>;
  security?: Record<string, string>;
}

const NEVER_AUTO = new Set(["never_auto", "never"]);
const ALLOWED = new Set(["allow", "workspace"]);
const RED_OPERATIONS = new Set(["submit_assignment", "send_message", "send_email", "production_deploy", "use_secret"]);
const DESTRUCTIVE_TERMINAL = /(^|\s)(rm|del|erase|format|shutdown|reboot|diskpart|mkfs)(\s|$)/i;
const SAFE_COMMANDS = new Set(["node", "npm", "npx", "pnpm", "yarn", "git", "tsc", "tsx", "python", "python3"]);

export class PermissionEngine {
  constructor(private readonly policy: PermissionPolicy) {}

  evaluate(action: AgentAction, context: AgentContext, input?: unknown): AgentAction {
    const permission = this.permissionFor(action, context, input);
    const risk = RED_OPERATIONS.has(action.operation.toLowerCase()) ? "red" : this.riskForPermission(permission, action.risk);
    return { ...action, risk, requiresApproval: risk !== "green" };
  }

  private permissionFor(action: AgentAction, context: AgentContext, input?: unknown): string {
    const tool = action.tool.toLowerCase();
    const op = action.operation.toLowerCase();
    if (op === "use_secret" || op.includes("bypass_mfa") || op.includes("bypass_captcha") || op.includes("bypass_tenant")) return "never_auto";

    if (tool === "filesystem" || op.includes("file")) {
      if (op.includes("delete") || op.includes("remove")) return this.policy.filesystem.delete;
      if (op.includes("write") || op.includes("edit") || op.includes("create")) return this.policy.filesystem.write;
      return this.policy.filesystem.read;
    }
    if (tool === "terminal" || op.includes("command")) {
      const command = this.commandName(input);
      if (command && DESTRUCTIVE_TERMINAL.test(command)) return this.policy.terminal.destructive_commands;
      return command && SAFE_COMMANDS.has(command) ? this.policy.terminal.safe_commands : this.policy.terminal.unknown_commands;
    }
    if (tool === "git" || op.startsWith("git_")) {
      if (op.includes("reset")) return this.policy.git.reset ?? "approval";
      if (op.includes("push")) return this.policy.git.push;
      if (op.includes("commit")) return this.policy.git.commit;
      return this.policy.git.read;
    }
    if (tool === "github") {
      const github = this.policy.github;
      if (!github) return "approval";
      if (op.includes("delete")) return github.delete;
      if (op.includes("merge")) return github.merge;
      if (op.includes("write") || op.includes("create") || op.includes("update")) return github.write;
      return github.read;
    }
    if (tool === "browser") {
      if (op.includes("download")) return this.policy.browser.download ?? "approval";
      if (op.includes("submit") || op.includes("send")) return this.policy.browser.submit;
      if (op.includes("write") || op.includes("click") || op.includes("type")) return this.policy.browser.write;
      return this.policy.browser.read;
    }
    if (tool === "computer") {
      const computer = this.policy.computer;
      if (!computer) return "approval";
      if (op.includes("system")) return computer.system;
      if (op.includes("type")) return computer.type;
      if (op.includes("click")) return computer.click;
      return computer.read;
    }
    if (tool === "system" || op.includes("administrator") || op.includes("shutdown") || op.includes("system_settings")) {
      if (op.includes("administrator")) return this.policy.system.administrator;
      if (op.includes("shutdown") || op.includes("reboot")) return this.policy.system.shutdown ?? "never_auto";
      return this.policy.system.settings;
    }
    if (context.mode === "school" || tool === "school") {
      const key = this.schoolKey(op);
      if (key && this.policy.school[key]) return this.policy.school[key];
    }
    return action.risk === "green" ? "allow" : "approval";
  }

  private riskForPermission(permission: string, fallback: ActionRisk): ActionRisk {
    // A red classification is a hard safety floor. Policy evaluation must never
    // downgrade it to yellow/green merely because the fallback permission is approval.
    if (fallback === "red") return "red";
    if (NEVER_AUTO.has(permission)) return "red";
    if (ALLOWED.has(permission)) return "green";
    if (permission === "approval") return "yellow";
    return "yellow";
  }

  private commandName(input: unknown): string | undefined {
    if (typeof input !== "object" || input === null) return undefined;
    const command = (input as { command?: unknown }).command;
    if (typeof command !== "string") return undefined;
    return command.trim().split(/\s+/)[0]?.replace(/^['\"]|['\"]$/g, "").toLowerCase();
  }

  private schoolKey(operation: string): string | undefined {
    const normalized = operation.replace(/^school[.:_]?/, "");
    const aliases: Record<string, string> = { read: "read_assignments", analyse: "analyse_assignments", analyze: "analyse_assignments", draft: "draft_answers", write: "write_to_school_portal", submit: "submit_assignment", send: "send_messages" };
    return this.policy.school[normalized] ? normalized : aliases[normalized];
  }
}
