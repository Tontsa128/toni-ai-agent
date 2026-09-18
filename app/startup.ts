import { createApplication, type ApplicationContext } from "./bootstrap/createApplication.js";

export type AgentRuntime = ApplicationContext;

export async function initializeAgentRuntime(workspace = process.cwd()): Promise<AgentRuntime> {
  return createApplication(workspace);
}

export function createInteractiveSession(runtime: AgentRuntime, userId = "local-user") {
  return runtime.createInteractiveSession(userId);
}
