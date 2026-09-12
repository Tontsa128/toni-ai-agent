import { OpenAIProvider } from "../agent/providers/OpenAIProvider.js";

export type SessionCommand =
  | { type: "help" }
  | { type: "reset" }
  | { type: "status" }
  | { type: "model"; value?: string }
  | { type: "exit" }
  | { type: "request"; value: string }
  | { type: "empty" };

export interface InteractiveSessionOptions {
  model?: string;
  workspace: string;
}

export interface SessionReply {
  kind: "command" | "model";
  text: string;
  exit?: boolean;
}

export function parseSessionInput(input: string): SessionCommand {
  const value = input.trim();
  if (!value) return { type: "empty" };
  if (!value.startsWith("/")) return { type: "request", value };

  const [command, ...args] = value.slice(1).split(/\s+/);
  switch (command?.toLowerCase()) {
    case "help":
      return { type: "help" };
    case "reset":
      return { type: "reset" };
    case "status":
      return { type: "status" };
    case "exit":
    case "quit":
      return { type: "exit" };
    case "model":
      return { type: "model", ...(args.length > 0 ? { value: args.join(" ") } : {}) };
    default:
      return { type: "request", value };
  }
}

export class InteractiveSession {
  private model: string;
  private previousResponseId: string | undefined;
  private requestCount = 0;

  constructor(private readonly options: InteractiveSessionOptions) {
    this.model = options.model ?? process.env.OPENAI_MODEL ?? "gpt-5.6-luna";
  }

  getState(): { model: string; workspace: string; requestCount: number; hasConversation: boolean } {
    return {
      model: this.model,
      workspace: this.options.workspace,
      requestCount: this.requestCount,
      hasConversation: this.previousResponseId !== undefined
    };
  }

  executeCommand(command: SessionCommand): SessionReply | undefined {
    switch (command.type) {
      case "empty":
        return undefined;
      case "help":
        return {
          kind: "command",
          text: [
            "/help             Näytä komennot",
            "/status           Näytä istunnon tila",
            "/model            Näytä nykyinen malli",
            "/model <nimi>     Vaihda malli seuraaville pyynnöille",
            "/reset            Nollaa keskustelun tilan",
            "/exit             Sulje Toni AI Agent",
            "",
            "Muut rivit lähetetään mallille."
          ].join("\n")
        };
      case "status": {
        const state = this.getState();
        return {
          kind: "command",
          text: [
            `Malli: ${state.model}`,
            `Workspace: ${state.workspace}`,
            `Pyyntöjä: ${state.requestCount}`,
            `Keskustelutila: ${state.hasConversation ? "aktiivinen" : "tyhjä"}`
          ].join("\n")
        };
      }
      case "model":
        if (!command.value) {
          return { kind: "command", text: `Nykyinen malli: ${this.model}` };
        }
        this.model = command.value;
        return { kind: "command", text: `Malli vaihdettu: ${this.model}` };
      case "reset":
        this.previousResponseId = undefined;
        this.requestCount = 0;
        return { kind: "command", text: "Keskustelutila nollattu." };
      case "exit":
        return { kind: "command", text: "Toni AI Agent suljetaan.", exit: true };
      case "request":
        return undefined;
    }
  }

  async ask(input: string): Promise<string> {
    const provider = new OpenAIProvider(this.model);
    const response = await provider.complete({
      model: this.model,
      input,
      instructions: [
        "Olet Toni AI Agent, paikallinen ensisijaisesti suomenkielinen tekninen ja oppimisen avustaja.",
        "Ole käytännöllinen ja täsmällinen. Älä arvaa: jos tieto puuttuu, kerro se.",
        "Tämä keskustelu on ohjattu käyttöliittymä; älä väitä suorittaneesi työkalutoimintoa, jota et ole saanut suoritettavaksi.",
        `Työtila: ${this.options.workspace}`
      ].join("\n"),
      ...(this.previousResponseId ? { previousResponseId: this.previousResponseId } : {})
    });
    this.previousResponseId = response.id;
    this.requestCount += 1;
    return response.text;
  }
}
