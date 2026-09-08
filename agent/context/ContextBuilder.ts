import type { AgentContext } from "../types.js";

export interface ContextSnapshot {
  request: string;
  mode: AgentContext["mode"];
  workspace?: string;
  projectState: string[];
  relevantFiles: string[];
  errors: string[];
  constraints: string[];
  acceptanceCriteria: string[];
}

export class ContextBuilder {
  build(context: AgentContext, extra: Partial<Omit<ContextSnapshot, "request" | "mode" | "workspace">> = {}): ContextSnapshot {
    return {
      request: context.userRequest,
      mode: context.mode,
      workspace: context.workspace,
      projectState: extra.projectState ?? [],
      relevantFiles: extra.relevantFiles ?? [],
      errors: extra.errors ?? [],
      constraints: extra.constraints ?? ["Never expose secrets", "Never bypass MFA/CAPTCHA/access controls"],
      acceptanceCriteria: extra.acceptanceCriteria ?? []
    };
  }
}
