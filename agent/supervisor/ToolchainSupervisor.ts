import type { AgentAction } from "../types.js";
import type { ToolInvocation } from "../sandbox/types.js";

export class ToolchainSupervisor {
  inspect(invocation: ToolInvocation): Omit<AgentAction, "id" | "createdAt"> {
    const risk = this.classify(invocation);
    return {
      tool: invocation.tool,
      operation: invocation.operation,
      description: `Tool ${invocation.tool} requested operation ${invocation.operation}`,
      risk,
      requiresApproval: risk !== "green"
    };
  }

  private classify(invocation: ToolInvocation): AgentAction["risk"] {
    if (invocation.risk === "red") return "red";
    const op = invocation.operation.toLowerCase();
    const tool = invocation.tool.toLowerCase();
    if (/(delete|remove|format|shutdown|reboot|administrator|reset)/.test(op)) return "red";
    if (/(browser|github|computer)/.test(tool)) return "yellow";
    if (/(write|push|commit|submit|send|download|install)/.test(op)) return "yellow";
    return invocation.risk;
  }
}
