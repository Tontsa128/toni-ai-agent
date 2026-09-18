import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { AgentContext } from "../agent/types.js";
import { initializeAgentRuntime } from "./startup.js";
import { parseSessionInput } from "./InteractiveSession.js";

const workspace = process.cwd();
const runtime = await initializeAgentRuntime(workspace);
const agent = runtime.orchestrator;

const args = process.argv.slice(2);
const request = args.join(" ").trim();

if (request) {
  const context: AgentContext = { mode: "coding", workspace, userRequest: request };
  console.log(JSON.stringify(agent.plan(context), null, 2));
  process.exit(0);
}

const session = runtime.session;
const rl = createInterface({ input, output, terminal: true });

console.log("Toni AI Agent");
console.log("Suomenkielinen interaktiivinen tila. /help näyttää komennot.\n");

try {
  while (true) {
    const line = await rl.question("toni> ");
    const command = parseSessionInput(line);

    if (command.type === "approve") {
      if (!command.actionId) {
        console.log("Käyttö: /approve <actionId>");
        continue;
      }
      try {
        const result = await session.approve(command.actionId);
        console.log(`\nHyväksytty ja suoritettu ${command.actionId}:\n${result}\n`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`\nHyväksyntä epäonnistui: ${message}\n`);
      }
      continue;
    }

    const reply = session.executeCommand(command);
    if (reply) {
      console.log(reply.text);
      if (reply.exit) break;
      continue;
    }

    if (command.type !== "request") continue;

    try {
      const answer = await session.ask(command.value);
      console.log(`\n${answer.text}\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`\nVirhe: ${message}\n`);
    }
  }
} finally {
  rl.close();
}
