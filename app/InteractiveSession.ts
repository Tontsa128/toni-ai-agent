import { OpenAIToolLoop, type ToolLoopResult, type PendingToolApproval } from "../agent/providers/OpenAIToolLoop.js";
import { SupervisedToolExecutor } from "../agent/core/SupervisedToolExecutor.js";
import { AgentOrchestrator } from "../agent/core/AgentOrchestrator.js";
import { createDefaultToolRegistry, defaultFunctionToolSpecs } from "../agent/tools/DefaultToolRegistry.js";
import type { PermissionPolicy } from "../agent/core/PermissionEngine.js";
import {
  CodingRepairCoordinator,
  type ResumableCodingRepairCoordinatorOptions
} from "../agent/coding/CodingRepairCoordinator.js";

export type SessionCommand =
  | { type: "help" } | { type: "reset" } | { type: "status" }
  | { type: "approvals" } | { type: "approve"; actionId?: string }
  | { type: "reject"; actionId?: string } | { type: "model"; value?: string }
  | { type: "exit" } | { type: "request"; value: string } | { type: "empty" };

export interface InteractiveRepairOptions {
  maxAttempts?: number;
  verify: ResumableCodingRepairCoordinatorOptions["verify"];
  repair: ResumableCodingRepairCoordinatorOptions["repair"];
}

export interface InteractiveSessionOptions {
  model?: string;
  workspace: string;
  policy?: PermissionPolicy;
  repair?: InteractiveRepairOptions;
}

export interface SessionReply { kind: "command" | "model" | "tool"; text: string; exit?: boolean; }

const FALLBACK_POLICY: PermissionPolicy = {
  filesystem: { read: "allow", write: "workspace", delete: "approval" },
  terminal: { safe_commands: "allow", unknown_commands: "approval", destructive_commands: "approval" },
  git: { read: "allow", commit: "approval", push: "approval" },
  browser: { read: "approval", write: "approval", submit: "approval" },
  system: { settings: "approval", administrator: "never_auto" },
  school: { read_assignments: "allow", analyse_assignments: "allow", draft_answers: "allow", write_to_school_portal: "approval", submit_assignment: "approval", send_messages: "approval" }
};

export function parseSessionInput(input: string): SessionCommand {
  const value = input.trim();
  if (!value) return { type: "empty" };
  if (!value.startsWith("/")) return { type: "request", value };
  const [command, ...args] = value.slice(1).split(/\s+/);
  switch (command?.toLowerCase()) {
    case "help": return { type: "help" }; case "reset": return { type: "reset" };
    case "status": return { type: "status" }; case "approvals": return { type: "approvals" };
    case "approve": return { type: "approve", ...(args[0] ? { actionId: args[0] } : {}) };
    case "reject": return { type: "reject", ...(args[0] ? { actionId: args[0] } : {}) };
    case "exit": case "quit": return { type: "exit" };
    case "model": return { type: "model", ...(args.length ? { value: args.join(" ") } : {}) };
    default: return { type: "request", value };
  }
}

export class InteractiveSession {
  private readonly orchestrator: AgentOrchestrator;
  private readonly executor: SupervisedToolExecutor;
  private readonly repairCoordinator: CodingRepairCoordinator | undefined;
  private toolLoop: OpenAIToolLoop | undefined;
  private model: string;
  private previousResponseId: string | undefined;
  private pendingToolApproval: PendingToolApproval | undefined;
  private requestCount = 0;

  constructor(private readonly options: InteractiveSessionOptions) {
    this.model = options.model ?? process.env.OPENAI_MODEL ?? "gpt-5.6-luna";
    this.orchestrator = new AgentOrchestrator(options.policy ?? FALLBACK_POLICY);
    this.executor = new SupervisedToolExecutor(this.orchestrator, createDefaultToolRegistry(options.workspace), {
      mode: "coding", workspace: options.workspace, userRequest: "interactive session"
    });
    if (options.repair) {
      this.repairCoordinator = new CodingRepairCoordinator({
        mode: "resumable",
        ...(options.repair.maxAttempts === undefined ? {} : { maxAttempts: options.repair.maxAttempts }),
        verify: options.repair.verify,
        repair: options.repair.repair
      });
    }
  }

  private ensureToolLoop(): OpenAIToolLoop {
    if (!this.toolLoop) this.toolLoop = new OpenAIToolLoop({ model: this.model });
    return this.toolLoop;
  }

  getState() {
    const repair = this.repairCoordinator?.snapshot();
    return {
      model: this.model,
      workspace: this.options.workspace,
      requestCount: this.requestCount,
      hasConversation: this.previousResponseId !== undefined,
      pendingApprovals: this.executor.continuations.listActionIds().length,
      pendingRepairApproval: repair?.state === "waiting_approval" ? repair.approval : undefined,
      repairState: repair?.state
    };
  }

  executeCommand(command: SessionCommand): SessionReply | undefined {
    switch (command.type) {
      case "empty": return undefined;
      case "help": return { kind: "command", text: [
        "/help  /status  /approvals", "/approve <actionId>  /reject <actionId>",
        "/model [nimi]  /reset  /exit", "Muut rivit lähetetään mallille."
      ].join("\n") };
      case "status": {
        const s = this.getState();
        return { kind: "command", text: [
          `Malli: ${s.model}`, `Workspace: ${s.workspace}`, `Pyyntöjä: ${s.requestCount}`,
          `Keskustelutila: ${s.hasConversation ? "aktiivinen" : "tyhjä"}`,
          `Odottaa työkaluhyväksyntää: ${s.pendingApprovals}`,
          `Korjaustila: ${s.repairState ?? "ei käytössä"}`,
          s.pendingRepairApproval ? `Odottaa korjaushyväksyntää: ${s.pendingRepairApproval.actionId}` : ""
        ].filter(Boolean).join("\n") };
      }
      case "approvals": {
        const ids = this.executor.continuations.listActionIds();
        const repair = this.repairCoordinator?.snapshot();
        const lines = [...ids.map((id) => `Työkalu: ${id}`)];
        if (repair?.state === "waiting_approval" && repair.approval) lines.push(`Korjaus: ${repair.approval.actionId}`);
        return { kind: "command", text: lines.length ? `Odottaa hyväksyntää:\n${lines.join("\n")}` : "Ei odottavia hyväksyntöjä." };
      }
      case "approve":
        return { kind: "command", text: command.actionId ? `Hyväksyntä suoritetaan komennolla /approve ${command.actionId}.` : "Käyttö: /approve <actionId>" };
      case "reject":
        if (!command.actionId) return { kind: "command", text: "Käyttö: /reject <actionId>" };
        this.executor.reject(command.actionId);
        if (this.pendingToolApproval?.actionId === command.actionId) this.pendingToolApproval = undefined;
        if (this.repairCoordinator) this.repairCoordinator.reject(command.actionId);
        return { kind: "command", text: `Toiminto hylätty: ${command.actionId}` };
      case "model":
        if (!command.value) return { kind: "command", text: `Nykyinen malli: ${this.model}` };
        this.model = command.value; this.previousResponseId = undefined; this.pendingToolApproval = undefined; this.toolLoop = undefined;
        return { kind: "command", text: `Malli vaihdettu: ${this.model}` };
      case "reset":
        this.previousResponseId = undefined; this.pendingToolApproval = undefined; this.requestCount = 0;
        return { kind: "command", text: "Keskustelutila nollattu." };
      case "exit": return { kind: "command", text: "Toni AI Agent suljetaan.", exit: true };
      case "request": return undefined;
    }
  }

  async approve(actionId: string): Promise<string> {
    if (this.pendingToolApproval?.actionId === actionId) {
      const pending = this.pendingToolApproval;
      const result = await this.executor.approveAndResume(actionId);
      this.pendingToolApproval = undefined;
      const resumed = await this.ensureToolLoop().resumeApprovedCall(
        pending.responseId,
        pending.callId,
        result,
        defaultFunctionToolSpecs(),
        this.executor
      );
      this.previousResponseId = resumed.responseId;
      this.requestCount += 1;
      if (resumed.pendingApproval) this.pendingToolApproval = resumed.pendingApproval;
      return resumed.text || JSON.stringify(result.output, null, 2);
    }

    if (this.repairCoordinator?.snapshot().state === "waiting_approval") {
      const result = await this.repairCoordinator.approve(actionId);
      if (result.state === "waiting_approval") return `Korjaus odottaa edelleen hyväksyntää: ${result.approval?.actionId ?? actionId}`;
      if (result.state === "succeeded") return "Korjaus hyväksyttiin ja varmennus onnistui.";
      return `Korjaus hyväksyntä käsitelty: ${result.state}${result.reason ? ` — ${result.reason}` : ""}`;
    }

    throw new Error(`No resumable approval found for action ${actionId}`);
  }

  async ask(input: string): Promise<ToolLoopResult> {
    if (this.pendingToolApproval) throw new Error(`Approval required first: /approve ${this.pendingToolApproval.actionId}`);
    const repair = this.repairCoordinator?.snapshot();
    if (repair?.state === "waiting_approval") throw new Error(`Repair approval required first: /approve ${repair.approval?.actionId ?? "<actionId>"}`);

    const result = await this.ensureToolLoop().run(
      input,
      defaultFunctionToolSpecs(),
      this.executor,
      [
        "Olet Toni AI Agent, paikallinen ensisijaisesti suomenkielinen tekninen avustaja.",
        "Inspect before editing. Älä arvaa. Käytä vain annettuja työkaluja.",
        "Työkalut ovat turvallisuusvalvottuja. Hyväksyntää vaativaa toimintoa ei saa kiertää.",
        "Älä väitä tehneesi muutosta, jota työkalu ei vahvista.", `Työtila: ${this.options.workspace}`
      ].join("\n"),
      this.previousResponseId
    );
    this.previousResponseId = result.responseId;
    this.pendingToolApproval = result.pendingApproval;
    this.requestCount += 1;
    return result;
  }

  async startRepair(): Promise<ReturnType<CodingRepairCoordinator["snapshot"]>> {
    if (!this.repairCoordinator) throw new Error("Resumable repair is not configured for this session");
    if (this.pendingToolApproval) throw new Error(`Approval required first: /approve ${this.pendingToolApproval.actionId}`);
    return this.repairCoordinator.start();
  }
}
