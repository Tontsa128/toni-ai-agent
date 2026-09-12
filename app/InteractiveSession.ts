import { OpenAIToolLoop, type ToolLoopResult } from "../agent/providers/OpenAIToolLoop.js";
import { SupervisedToolExecutor } from "../agent/core/SupervisedToolExecutor.js";
import { AgentOrchestrator } from "../agent/core/AgentOrchestrator.js";
import { createDefaultToolRegistry, defaultFunctionToolSpecs } from "../agent/tools/DefaultToolRegistry.js";
import type { PermissionPolicy } from "../agent/core/PermissionEngine.js";

export type SessionCommand =
  | { type: "help" }
  | { type: "reset" }
  | { type: "status" }
  | { type: "approvals" }
  | { type: "approve"; actionId?: string }
  | { type: "reject"; actionId?: string }
  | { type: "model"; value?: string }
  | { type: "exit" }
  | { type: "request"; value: string }
  | { type: "empty" };

export interface InteractiveSessionOptions { model?: string; workspace: string; policy: PermissionPolicy; }
export interface SessionReply { kind: "command" | "model" | "tool"; text: string; exit?: boolean; }

export function parseSessionInput(input: string): SessionCommand {
  const value = input.trim();
  if (!value) return { type: "empty" };
  if (!value.startsWith("/")) return { type: "request", value };
  const [command, ...args] = value.slice(1).split(/\s+/);
  switch (command?.toLowerCase()) {
    case "help": return { type: "help" };
    case "reset": return { type: "reset" };
    case "status": return { type: "status" };
    case "approvals": return { type: "approvals" };
    case "approve": return { type: "approve", ...(args[0] ? { actionId: args[0] } : {}) };
    case "reject": return { type: "reject", ...(args[0] ? { actionId: args[0] } : {}) };
    case "exit":
    case "quit": return { type: "exit" };
    case "model": return { type: "model", ...(args.length ? { value: args.join(" ") } : {}) };
    default: return { type: "request", value };
  }
}

export class InteractiveSession {
  private readonly orchestrator: AgentOrchestrator;
  private readonly executor: SupervisedToolExecutor;
  private toolLoop: OpenAIToolLoop;
  private model: string;
  private previousResponseId: string | undefined;
  private requestCount = 0;

  constructor(private readonly options: InteractiveSessionOptions) {
    this.model = options.model ?? process.env.OPENAI_MODEL ?? "gpt-5.6-luna";
    this.orchestrator = new AgentOrchestrator(options.policy);
    this.executor = new SupervisedToolExecutor(
      this.orchestrator,
      createDefaultToolRegistry(options.workspace),
      { mode: "coding", workspace: options.workspace, userRequest: "interactive session" }
    );
    this.toolLoop = new OpenAIToolLoop({ model: this.model });
  }

  getState() {
    return {
      model: this.model,
      workspace: this.options.workspace,
      requestCount: this.requestCount,
      hasConversation: this.previousResponseId !== undefined,
      pendingApprovals: this.executor.continuations.listActionIds().length
    };
  }

  executeCommand(command: SessionCommand): SessionReply | undefined {
    switch (command.type) {
      case "empty": return undefined;
      case "help": return { kind: "command", text: [
        "/help                 Näytä komennot",
        "/status               Näytä istunnon tila",
        "/approvals            Näytä odottavat hyväksynnät",
        "/approve <actionId>   Hyväksy odottava toiminto",
        "/reject <actionId>    Hylkää odottava toiminto",
        "/model                Näytä nykyinen malli",
        "/model <nimi>         Vaihda malli",
        "/reset                Nollaa keskustelutila",
        "/exit                 Sulje Toni AI Agent", "",
        "Muut rivit lähetetään mallille."
      ].join("\n") };
      case "status": {
        const state = this.getState();
        return { kind: "command", text: [
          `Malli: ${state.model}`, `Workspace: ${state.workspace}`,
          `Pyyntöjä: ${state.requestCount}`,
          `Keskustelutila: ${state.hasConversation ? "aktiivinen" : "tyhjä"}`,
          `Odottaa hyväksyntää: ${state.pendingApprovals}`
        ].join("\n") };
      }
      case "approvals": {
        const ids = this.executor.continuations.listActionIds();
        return { kind: "command", text: ids.length ? `Odottaa hyväksyntää:\n${ids.join("\n")}` : "Ei odottavia hyväksyntöjä." };
      }
      case "approve": return { kind: "command", text: command.actionId ? `Hyväksyntä voidaan suorittaa: ${command.actionId}` : "Käyttö: /approve <actionId>" };
      case "reject":
        if (!command.actionId) return { kind: "command", text: "Käyttö: /reject <actionId>" };
        this.executor.reject(command.actionId);
        return { kind: "command", text: `Toiminto hylätty: ${command.actionId}` };
      case "model":
        if (!command.value) return { kind: "command", text: `Nykyinen malli: ${this.model}` };
        this.model = command.value;
        this.previousResponseId = undefined;
        this.toolLoop = new OpenAIToolLoop({ model: this.model });
        return { kind: "command", text: `Malli vaihdettu: ${this.model}. Keskusteluketju aloitetaan uudelleen.` };
      case "reset":
        this.previousResponseId = undefined;
        this.requestCount = 0;
        return { kind: "command", text: "Keskustelutila nollattu." };
      case "exit": return { kind: "command", text: "Toni AI Agent suljetaan.", exit: true };
      case "request": return undefined;
    }
  }

  async approve(actionId: string): Promise<string> {
    const result = await this.executor.approveAndResume(actionId);
    return JSON.stringify(result.output, null, 2);
  }

  async ask(input: string): Promise<ToolLoopResult> {
    const result = await this.toolLoop.run(input, defaultFunctionToolSpecs(), this.executor, [
      "Olet Toni AI Agent, paikallinen ensisijaisesti suomenkielinen tekninen ja oppimisen avustaja.",
      "Inspect before editing. Älä arvaa. Käytä vain annettuja työkaluja.",
      "Työkalut ovat turvallisuusvalvottuja. Hyväksyntää vaativa toiminto pysäytetään eikä sitä saa kiertää.",
      "Älä koskaan väitä tehneesi muutosta, jota työkalu ei vahvista.",
      `Työtila: ${this.options.workspace}`
    ].join("\n"));
    this.previousResponseId = result.responseId;
    this.requestCount += 1;
    return result;
  }
}
