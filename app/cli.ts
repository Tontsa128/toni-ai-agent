import { loadPolicy } from "../tools/config.js";
import { AgentOrchestrator } from "../agent/core/AgentOrchestrator.js";
import type { AgentContext } from "../agent/types.js";

const workspace = process.cwd();
const policy = await loadPolicy(workspace);
const agent = new AgentOrchestrator(policy);

const request = process.argv.slice(2).join(" ").trim() || "Tarkista projektin rakenne ja ehdota seuraavat turvalliset kehitysaskeleet.";
const context: AgentContext = { mode: "coding", workspace, userRequest: request };

console.log(JSON.stringify(agent.plan(context), null, 2));
