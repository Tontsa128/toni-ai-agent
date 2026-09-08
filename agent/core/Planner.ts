import type { AgentContext } from "../types.js";

export interface PlanStep {
  id: string;
  title: string;
  description: string;
  tool?: string;
  operation?: string;
  expectedOutput: string;
}

export interface AgentPlan {
  goal: string;
  assumptions: string[];
  steps: PlanStep[];
  risks: string[];
}

export class Planner {
  createPlan(context: AgentContext): AgentPlan {
    return {
      goal: context.userRequest,
      assumptions: context.workspace ? [`Workspace: ${context.workspace}`] : [],
      steps: [
        { id: "inspect", title: "Inspect context", description: "Read relevant files, assignment or project state before changing anything.", expectedOutput: "Relevant context and constraints" },
        { id: "plan", title: "Plan", description: "Break the request into small verifiable actions.", expectedOutput: "Ordered implementation plan" },
        { id: "execute", title: "Execute", description: "Run only permitted actions and request approval for risky actions.", expectedOutput: "Changed state or draft" },
        { id: "verify", title: "Verify", description: "Run checks and inspect the result.", expectedOutput: "Verification report" }
      ],
      risks: []
    };
  }
}
