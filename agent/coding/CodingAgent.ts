import type { AgentContext } from "../types.js";
import { AgentOrchestrator } from "../core/AgentOrchestrator.js";
import { SupervisedToolExecutor } from "../core/SupervisedToolExecutor.js";
import { OpenAIToolLoop, type ToolLoopResult } from "../providers/OpenAIToolLoop.js";
import { createDefaultToolRegistry, defaultFunctionToolSpecs } from "../tools/DefaultToolRegistry.js";
import { RepositoryScanner, type RepositoryMap } from "./RepositoryScanner.js";
import {
  CodingRepairCoordinator,
  type ResumableCodingRepairCoordinatorOptions
} from "./CodingRepairCoordinator.js";
import type { RepairAction, RepairLoopResult, VerificationAction } from "./RepairLoop.js";
import type { PermissionPolicy } from "../core/PermissionEngine.js";
import type { RepairSessionSnapshot } from "./RepairSession.js";

export interface CodingAgentOptions {
  model?: string;
  maxTurns?: number;
  repairMaxAttempts?: number;
  verification?: VerificationAction;
  repair?: RepairAction;
  resumableRepair?: Omit<ResumableCodingRepairCoordinatorOptions, "mode">;
}

export interface CodingAgentResult {
  repository: RepositoryMap;
  loop: ToolLoopResult;
  repair?: RepairLoopResult;
  repairSession?: RepairSessionSnapshot;
}

const CODING_INSTRUCTIONS = [
  "You are Toni AI Agent's coding specialist.",
  "Work only inside the provided workspace.",
  "Inspect the repository before editing it. Use read_text_file and git_read first when relevant.",
  "Turn the user's request into explicit acceptance criteria before making changes.",
  "Make small, reversible, focused edits. Never write secrets, credentials, tokens, cookies, MFA codes, or private keys.",
  "Do not bypass permission controls. Tool writes and commands are supervised by the local executor.",
  "After code changes, run the project's available type-check, test, and build scripts when appropriate.",
  "If a bounded verification command fails, diagnose the error and make a focused correction; do not repeatedly retry unsafe or permission-related failures.",
  "Finish with a concise report of what changed and what verification actually passed or failed."
].join("\n");

export class CodingAgent {
  private readonly scanner: RepositoryScanner;
  private readonly executor: SupervisedToolExecutor;
  private readonly repairOptions: Pick<CodingAgentOptions, "repairMaxAttempts" | "verification" | "repair">;
  private readonly resumableRepair: CodingRepairCoordinator | undefined;
  private readonly toolLoopOptions: CodingAgentOptions;
  private toolLoop: OpenAIToolLoop | undefined;

  constructor(
    private readonly workspace: string,
    policy: PermissionPolicy,
    options: CodingAgentOptions = {}
  ) {
    this.scanner = new RepositoryScanner(workspace);
    const orchestrator = new AgentOrchestrator(policy);
    const registry = createDefaultToolRegistry(workspace);
    const context: AgentContext = { mode: "coding", workspace, userRequest: "coding task" };
    this.executor = new SupervisedToolExecutor(orchestrator, registry, context);
    this.toolLoopOptions = options;
    this.repairOptions = {
      ...(options.repairMaxAttempts === undefined ? {} : { repairMaxAttempts: options.repairMaxAttempts }),
      ...(options.verification === undefined ? {} : { verification: options.verification }),
      ...(options.repair === undefined ? {} : { repair: options.repair })
    };

    if (options.resumableRepair) {
      this.resumableRepair = new CodingRepairCoordinator({
        mode: "resumable",
        ...(options.resumableRepair.maxAttempts === undefined ? {} : { maxAttempts: options.resumableRepair.maxAttempts }),
        verify: options.resumableRepair.verify,
        repair: options.resumableRepair.repair
      });
    }
  }

  private ensureToolLoop(): OpenAIToolLoop {
    if (!this.toolLoop) this.toolLoop = new OpenAIToolLoop(this.toolLoopOptions);
    return this.toolLoop;
  }

  async run(request: string): Promise<CodingAgentResult> {
    const repository = await this.scanner.scan();
    const context = [
      "Repository inspection completed. Treat this as metadata only; read source files before editing.",
      this.scanner.summarize(repository),
      "",
      `User request: ${request}`
    ].join("\n");
    const loop = await this.ensureToolLoop().run(context, defaultFunctionToolSpecs(), this.executor, CODING_INSTRUCTIONS);

    // Never start automated or resumable repair while the model is paused for human approval.
    if (loop.pendingApproval) return { repository, loop };

    if (this.resumableRepair) {
      const repairSession = await this.resumableRepair.start();
      return { repository, loop, repairSession };
    }

    if (!this.repairOptions.verification || !this.repairOptions.repair) {
      return { repository, loop };
    }

    const coordinatorOptions = {
      verify: this.repairOptions.verification,
      repair: this.repairOptions.repair,
      ...(this.repairOptions.repairMaxAttempts === undefined
        ? {}
        : { maxAttempts: this.repairOptions.repairMaxAttempts })
    };
    const coordinator = new CodingRepairCoordinator(coordinatorOptions);
    const repair = await coordinator.run();
    return { repository, loop, repair };
  }

  async startRepair(): Promise<RepairSessionSnapshot> {
    if (!this.resumableRepair) {
      throw new Error("Resumable repair is not configured for this coding agent");
    }
    return this.resumableRepair.start();
  }

  async approveRepair(actionId: string): Promise<RepairSessionSnapshot> {
    if (!this.resumableRepair) {
      throw new Error("Resumable repair is not configured for this coding agent");
    }
    return this.resumableRepair.approve(actionId);
  }

  rejectRepair(actionId: string): RepairSessionSnapshot {
    if (!this.resumableRepair) {
      throw new Error("Resumable repair is not configured for this coding agent");
    }
    return this.resumableRepair.reject(actionId);
  }

  getRepairSnapshot(): RepairSessionSnapshot {
    if (!this.resumableRepair) {
      throw new Error("Resumable repair is not configured for this coding agent");
    }
    return this.resumableRepair.snapshot();
  }
}

export { CODING_INSTRUCTIONS };
