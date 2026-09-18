import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createInteractiveSession, initializeAgentRuntime } from "./startup.js";
import { parseSessionInput } from "./InteractiveSession.js";

const workspace = process.cwd();
const runtime = await initializeAgentRuntime(workspace);
const session = createInteractiveSession(runtime);
const rl = createInterface({ input, output, terminal: true });

console.log("Toni AI Agent");
console.log("Suomenkielinen interaktiivinen tila. /help näyttää komennot.\n");

try {
  while (true) {
    const line = await rl.question("toni> ");
    const command = parseSessionInput(line);

    if (command.type === "approve" && command.actionId) {
      try {
        console.log(`\nSuoritetaan hyväksytty toiminto ${command.actionId}...`);
        console.log(await session.approve(command.actionId));
      } catch (error) {
        console.error(`\nHyväksynnän suoritus epäonnistui: ${error instanceof Error ? error.message : String(error)}\n`);
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
      const result = await session.ask(command.value);
      console.log(`\n${result.text}\n`);
    } catch (error) {
      console.error(`\nVirhe: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }
} finally {
  rl.close();
}
