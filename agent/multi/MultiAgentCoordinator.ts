export type AgentRole = "coder" | "researcher" | "school" | "browser" | "computer" | "reviewer";
export interface AgentTask { id: string; role: AgentRole; goal: string; dependencies: string[]; }
export interface AgentResult { taskId: string; ok: boolean; summary: string; artifacts: string[]; }

export class MultiAgentCoordinator {
  private readonly tasks = new Map<string, AgentTask>();
  addTask(task: AgentTask): void { if (this.tasks.has(task.id)) throw new Error(`Duplicate task: ${task.id}`); this.tasks.set(task.id, task); }
  ready(completed: Set<string>): AgentTask[] { return [...this.tasks.values()].filter((task) => task.dependencies.every((d) => completed.has(d))); }
}
