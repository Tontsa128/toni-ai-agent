export type PermissionLevel =
  | "allow"
  | "workspace"
  | "approval"
  | "never_auto";

export type ActionRisk = "green" | "yellow" | "red";

export type AgentMode =
  | "coding"
  | "school"
  | "research"
  | "computer";

export interface AgentAction {
  id: string;
  tool: string;
  operation: string;
  description: string;
  risk: ActionRisk;
  requiresApproval: boolean;
  createdAt: string;
}

export interface ApprovalRequest {
  action: AgentAction;
  reason: string;
  approved?: boolean;
}

export interface AgentContext {
  mode: AgentMode;
  workspace?: string;
  userRequest: string;
}
