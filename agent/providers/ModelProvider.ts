export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  risk: "green" | "yellow" | "red";
}

export interface ModelProvider {
  readonly name: string;
  complete(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<string>;
}

export interface AgentKnowledge {
  projectState: string;
  relevantFiles: string[];
  previousAttempts: string[];
  constraints: string[];
}

export function buildAgentContext(knowledge: AgentKnowledge, request: string): LLMMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are Toni AI Agent, a local-first engineering and learning assistant.",
        "Inspect before editing. Prefer small, reversible changes.",
        "Never expose secrets. Never bypass MFA, CAPTCHA, tenant restrictions or access controls.",
        "Require explicit approval before consequential actions.",
        `Project state: ${knowledge.projectState}`,
        `Relevant files: ${knowledge.relevantFiles.join(", ")}`,
        `Previous attempts: ${knowledge.previousAttempts.join(" | ")}`,
        `Constraints: ${knowledge.constraints.join(" | ")}`
      ].join("\n")
    },
    { role: "user", content: request }
  ];
}
