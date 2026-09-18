import type { ToolRisk } from "../tools/ToolRegistry.js";

export type ToolPermissionDecision = "allow" | "approval_required" | "deny";

export interface ToolPermissionRequest {
  sessionId: string;
  toolName: string;
  risk: ToolRisk;
  argumentHash: string;
  hasValidApproval: boolean;
}

export interface ToolPermissionResult {
  decision: ToolPermissionDecision;
  reason: string;
}

export function decideToolPermission(request: ToolPermissionRequest): ToolPermissionResult {
  if (request.risk === "green") {
    return { decision: "allow", reason: "Green tools may run automatically." };
  }
  if (request.risk === "yellow" && request.hasValidApproval) {
    return { decision: "allow", reason: "Valid approval was supplied." };
  }
  if (request.risk === "yellow") {
    return { decision: "approval_required", reason: "Yellow tool requires approval." };
  }
  if (request.risk === "red" && request.hasValidApproval) {
    return {
      decision: "approval_required",
      reason: "Red tool requires explicit approval and additional policy checks."
    };
  }
  return { decision: "deny", reason: "Red tool is not allowed automatically." };
}
