import { resolve } from "node:path";
import { access, constants, realpath, stat } from "node:fs/promises";
import { loadConfig, type AppConfig } from "../../config/env.js";
import { createAppPaths } from "../../config/paths.js";
import { mkdir } from "node:fs/promises";
import { verifyDatabase } from "../../storage/DatabaseHealth.js";
import { verifyAuditChain } from "../../agent/audit/verifyAuditChain.js";
import { CostBudget } from "../../agent/limits/CostBudget.js";
import { ProviderBudget } from "../../agent/limits/ProviderBudget.js";
import { loadPolicy } from "../../tools/config.js";
import { ToniDatabase } from "../../storage/Database.js";
import { ApprovalRepository } from "../../storage/repositories/ApprovalRepository.js";
import { AuditRepository } from "../../storage/repositories/AuditRepository.js";
import { SqliteApprovalAdapter } from "../../agent/approvals/SqliteApprovalAdapter.js";
import { AgentOrchestrator } from "../../agent/core/AgentOrchestrator.js";
import { SupervisedToolExecutor } from "../../agent/core/SupervisedToolExecutor.js";
import { OpenAIProvider } from "../../agent/providers/OpenAIProvider.js";
import { registerAllTools } from "../../agent/tools/registerAllTools.js";
import type { DefaultToolRegistryOptions } from "../../agent/tools/DefaultToolRegistry.js";
import { ToolRegistry } from "../../agent/tools/ToolRegistry.js";
import { SessionBudget } from "../../agent/limits/SessionBudget.js";
import { SessionLock } from "../../agent/core/SessionLock.js";
import { CancellationRegistry } from "../../agent/core/CancellationRegistry.js";
import { HealthService } from "../health/HealthService.js";
import { runStartupChecks, type StartupCheck } from "../health/StartupChecks.js";
import { StartupState } from "../lifecycle/StartupState.js";
import { WindowsJobController, type WindowsJobOptions } from "../../agent/worker/WindowsJobController.js";
import { DEFAULT_WORKER_LIMITS } from "../../agent/worker/WorkerLimits.js";
import { InteractiveSession } from "../InteractiveSession.js";
import { Logger } from "../observability/Logger.js";
import { Metrics } from "../observability/Metrics.js";

export interface ApplicationContext {
  workspace: string;
  config: AppConfig;
  state: StartupState;
  database: ToniDatabase;
  approvalRepository: ApprovalRepository;
  approvalStore: SqliteApprovalAdapter;
  auditRepository: AuditRepository;
  healthService: HealthService;
  modelProvider: OpenAIProvider;
  registry: ToolRegistry;
  orchestrator: AgentOrchestrator;
  cancellation: CancellationRegistry;
  createSessionBudget: () => SessionBudget;
  createSessionLock: () => SessionLock;
  createSessionCancellation: () => CancellationRegistry;
  createInteractiveSession: (userId?: string) => InteractiveSession;
  windowsJob?: WindowsJobOptions;
  logger: Logger;
  metrics: Metrics;
}

export async function createApplication(workspace?: string): Promise<ApplicationContext> {
  const state = new StartupState();
  let database: ToniDatabase | undefined;
  try {
    const config = loadConfig();
    const paths = createAppPaths();
    await mkdir(paths.dataRoot, { recursive: true });
    await mkdir(paths.auditDirectory, { recursive: true });
    await mkdir(paths.logDirectory, { recursive: true });
    const logger = new Logger(config.environment === "production" ? "info" : "debug");
    const metrics = new Metrics();
    state.setPhase("config_loaded");

    const resolvedWorkspace = await realpath(resolve(workspace ?? paths.workspaceDirectory));
    const workspaceStats = await stat(resolvedWorkspace);
    if (!workspaceStats.isDirectory()) throw new Error("Workspace is not a directory.");

    database = new ToniDatabase(paths.databaseFile);
    database.initialize();
    const approvalRepository = new ApprovalRepository(database.connection());
    const approvalStore = new SqliteApprovalAdapter(approvalRepository, config.approvalTtlMs);
    const auditRepository = new AuditRepository(database.connection());
    auditRepository.initialize();
    state.setPhase("storage_ready");

    const policy = await loadPolicy(resolvedWorkspace);
    const orchestrator = new AgentOrchestrator(policy);

    let windowsJob: WindowsJobOptions | undefined;
    if (process.platform === "win32" && config.windowsJobHelperPath) {
      windowsJob = {
        helperPath: config.windowsJobHelperPath,
        memoryMb: config.workerMemoryMb,
        maxProcesses: config.workerMaxProcesses,
        cpuTimeMs: config.workerCpuTimeMs,
        trustedRoot: config.windowsTrustedRoot
      };
    }

    const startupJobCheck: StartupCheck = {
      name: "windows-job-helper",
      requiredInProduction: process.platform === "win32",
      async run(): Promise<void> {
        if (process.platform !== "win32") return;
        if (!windowsJob) throw new Error("TONI_JOB_HELPER_PATH is required on Windows.");
        const controller = new WindowsJobController(windowsJob);
        await controller.validate();
        if (config.environment === "production") {
          try {
            await access(config.windowsTrustedRoot, constants.W_OK);
            throw new Error("Trusted installation root must not be writable by the application account.");
          } catch (error: unknown) {
            if (error instanceof Error && error.message.includes("must not be writable")) throw error;
          }
        }
      }
    };

    const registry = new ToolRegistry();
    const toolOptions: DefaultToolRegistryOptions = {
      workerLimits: {
        ...DEFAULT_WORKER_LIMITS,
        timeoutMs: config.commandTimeoutMs,
        maxProcesses: config.workerMaxProcesses,
        maxMemoryMb: config.workerMemoryMb
      },
      ...(windowsJob ? { windowsJob } : {})
    };
    registerAllTools(registry, resolvedWorkspace, toolOptions);

    state.setPhase("tools_ready");
    const modelProvider = new OpenAIProvider(config.openAiModel);
    state.setPhase("providers_ready");

    const healthService = new HealthService({
      configurationReady: true,
      approvalStoreReady: true,
      modelConfigured: Boolean(config.openAiModel)
    });

    const checks: StartupCheck[] = [
      {
        name: "configuration",
        requiredInProduction: true,
        async run(): Promise<void> {
          if (!config.openAiModel) throw new Error("OPENAI_MODEL is missing.");
          if (config.environment === "production" && !config.openAiApiKey) throw new Error("OPENAI_API_KEY is missing.");
          if (config.environment === "production" && !config.authToken) throw new Error("TONI_AUTH_TOKEN is missing.");
        }
      },
      {
        name: "workspace",
        requiredInProduction: true,
        async run(): Promise<void> {
          await access(resolvedWorkspace, constants.R_OK | constants.X_OK);
        }
      },
      {
        name: "tool-registry",
        requiredInProduction: true,
        async run(): Promise<void> {
          if (registry.list().length === 0) throw new Error("No tools have been registered.");
        }
      },
      {
        name: "approval-storage",
        requiredInProduction: true,
        async run(): Promise<void> {
          approvalRepository.getActive("__startup_probe__");
        }
      },
      {
        name: "audit-storage",
        requiredInProduction: true,
        async run(): Promise<void> {
          verifyDatabase(database!.connection());
          verifyAuditChain(database!.connection());
          auditRepository.append({ type: "startup_check", message: "Application startup check." });
          const verification = auditRepository.verify();
          if (!verification.ok) throw new Error(verification.error);
        }
      },
      startupJobCheck
    ];

    await runStartupChecks(checks, config.environment === "production");
    state.setPhase("sandbox_ready");

    const application: ApplicationContext = {
      workspace: resolvedWorkspace,
      config,
      state,
      database,
      approvalRepository,
      approvalStore,
      auditRepository,
      healthService,
      modelProvider,
      registry,
      orchestrator,
      cancellation: new CancellationRegistry(),
      createSessionBudget: () => new SessionBudget(config.maxToolCalls),
      createSessionLock: () => new SessionLock(),
      createSessionCancellation: () => new CancellationRegistry(),
      ...(windowsJob ? { windowsJob } : {}),
      logger,
      metrics,
      createInteractiveSession: (userId = "local-user") => {
        const auditSink = {
          append: (event: { type: string; sessionId: string; actionId: string; summary?: string; reason?: string }) =>
            auditRepository.append({
              type: event.type,
              userId,
              sessionId: event.sessionId,
              actionId: event.actionId,
              message: event.reason ?? event.summary ?? event.type
            })
        };
        const executor = new SupervisedToolExecutor(
          orchestrator,
          registry,
          { mode: "coding", workspace: resolvedWorkspace, userRequest: "web session", userId },
          approvalStore,
          auditSink,
          config.maxToolCalls,
          logger,
          metrics
        );
        return new InteractiveSession({
          model: config.openAiModel,
          workspace: resolvedWorkspace,
          orchestrator,
          executor,
          toolRegistry: registry,
          costBudget: new CostBudget(config.maxInputTokens, config.maxOutputTokens, config.maxSessionUsd),
          providerBudget: new ProviderBudget(config.maxProviderRequests)
        });
      }
    };

    return application;
  } catch (error: unknown) {
    state.fail(error instanceof Error ? error.message : "Application startup failed.");
    try { database?.close(); } catch {}
    throw error;
  }
}

