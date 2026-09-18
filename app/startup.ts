import { resolve } from "node:path";
import { loadPolicy } from "../tools/config.js";
import { ApprovalStore } from "../agent/approvals/ApprovalStore.js";
import { AgentOrchestrator } from "../agent/core/AgentOrchestrator.js";
import { SupervisedToolExecutor } from "../agent/core/SupervisedToolExecutor.js";
import { ComputerActionController } from "../agent/computer/ComputerActionController.js";
import { OpenAIProvider } from "../agent/providers/OpenAIProvider.js";
import { createDefaultToolRegistry } from "../agent/tools/DefaultToolRegistry.js";
import { InteractiveSession } from "./InteractiveSession.js";
import { HealthService } from "./health/HealthService.js";
import { loadConfig, type AppConfig } from "../config/env.js";

export interface AgentRuntime {
  config: AppConfig;
  approvalStore: ApprovalStore;
  healthService: HealthService;
  modelProvider: OpenAIProvider;
  registry: ReturnType<typeof createDefaultToolRegistry>;
  orchestrator: AgentOrchestrator;
  executor: SupervisedToolExecutor;
  computerController: ComputerActionController;
  session: InteractiveSession;
}

export async function initializeAgentRuntime(workspace = process.cwd()): Promise<AgentRuntime> {
  // Startup order is intentional: each stage must succeed before the next is constructed.
  const config = loadConfig();

  const approvalStore = new ApprovalStore(
    resolve(workspace, "memory/approvals.json"),
    config.approvalTtlMs,
  );
  await approvalStore.init();

  const healthService = new HealthService({
    configurationReady: true,
    approvalStoreReady: true,
    modelConfigured: Boolean(config.openAiModel),
  });

  const modelProvider = new OpenAIProvider(config.openAiModel);
  const policy = await loadPolicy(workspace);
  const registry = createDefaultToolRegistry(workspace);
  const orchestrator = new AgentOrchestrator(policy);
  const executor = new SupervisedToolExecutor(orchestrator, registry, {
    mode: "coding",
    workspace,
    userRequest: "interactive session",
  });
  const computerController = new ComputerActionController(executor);
  const session = new InteractiveSession({
    model: config.openAiModel,
    workspace,
    policy,
    orchestrator,
    executor,
    toolRegistry: registry,
  });

  return { config, approvalStore, healthService, modelProvider, registry, orchestrator, executor, computerController, session };
}
