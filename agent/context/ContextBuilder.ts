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
    const snapshot: ContextSnapshot = {
      request: context.userRequest,
      mode: context.mode,
      projectState: extra.projectState ?? [],
      relevantFiles: extra.relevantFiles ?? [],
      errors: extra.errors ?? [],
      constraints: extra.constraints ?? ["Never expose secrets", "Never bypass MFA/CAPTCHA/access controls"],
      acceptanceCriteria: extra.acceptanceCriteria ?? []
    };

    if (context.workspace !== undefined) snapshot.workspace = context.workspace;
    return snapshot;
  }
}
