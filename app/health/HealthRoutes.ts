import type { IncomingMessage, ServerResponse } from "node:http";
import type { StartupState } from "../lifecycle/StartupState.js";
export function handleHealthRoute(request: IncomingMessage, response: ServerResponse, state: StartupState): boolean {
  if (request.method !== "GET" || (request.url !== "/health" && request.url !== "/ready")) return false;
  const ready = state.isReady();
  response.writeHead(request.url === "/ready" && !ready ? 503 : 200, {
    "content-type": "application/json",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify({ status: request.url === "/health" ? "ok" : ready ? "ok" : "degraded", phase: state.getPhase(), ready }));
  return true;
}