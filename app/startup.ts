import { resolve } from "node:path";
import { loadPolicy } from "../tools/config.js";
import { ApprovalStore } from "../agent/approvals/ApprovalStore.js";
import { AuditLog } from "../agent/audit/AuditLog.js";
import { AgentOrchestrator } from "../agent/core/AgentOrchestrator.js";
import { SupervisedToolExecutor } from "../agent/core/SupervisedToolExecutor.js";
import { ComputerActionController } from "../agent/computer/ComputerActionController.js";
import { OpenAIProvider } from "../agent/providers/OpenAIProvider.js";
import { createDefaultToolRegistry } from "../agent/tools/DefaultToolRegistry.js";
import { InteractiveSession } from "./InteractiveSession.js";
import { HealthService } from "./health/HealthService.js";
import { loadConfig, type AppConfig } from "../config/env.js";

export interface AgentRuntime {
  workspace: string;
  config: AppConfig;
  approvalStore: ApprovalStore;
  auditLog: AuditLog;
  healthService: HealthService;
  modelProvider: OpenAIProvider;
  registry: ReturnType<typeof createDefaultToolRegistry>;
  orchestrator: AgentOrchestrator;
  executor: SupervisedToolExecutor;
  computerController: ComputerActionController;
}

export async function initializeAgentRuntime(workspace = process.cwd()): Promise<AgentRuntime> {
  const config = loadConfig();
  const approvalStore = new ApprovalStore(resolve(workspace, "memory/approvals.json"), config.approvalTtlMs);
  await approvalStore.init();
  const auditLog = new AuditLog({ filePath: resolve(workspace, "memory/audit.log") });

  const healthService = new HealthService({
    configurationReady: true,
    approvalStoreReady: true,
    modelConfigured: Boolean(config.openAiModel),
  });

  const modelProvider = new OpenAIProvider(config.openAiModel);
  const policy = await loadPolicy(workspace);
  const registry = createDefaultToolRegistry(workspace);
  const orchestrator = new AgentOrchestrator(policy);
  const executor = new SupervisedToolExecutor(
    orchestrator,
    registry,
    { mode: "coding", workspace, userRequest: "interactive session" },
    approvalStore,
    auditLog,
    config.maxToolCalls
  );
  const computerController = new ComputerActionController(executor);
  return { workspace, config, approvalStore, auditLog, healthService, modelProvider, registry, orchestrator, executor, computerController };
}

export function createInteractiveSession(runtime: AgentRuntime): InteractiveSession {
  return new InteractiveSession({
    model: runtime.config.openAiModel,
    workspace: runtime.workspace,
    orchestrator: runtime.orchestrator,
    executor: runtime.executor,
    toolRegistry: runtime.registry,
  });
}
