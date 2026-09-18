import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { createInteractiveSession, initializeAgentRuntime } from "./startup.js";
import { handleHealthRoute } from "./health/HealthRoutes.js";
import { installShutdown } from "./lifecycle/installShutdown.js";
import { timingSafeEqual } from "node:crypto";
import { attachmentToContent, type AgentContentPart } from "./AgentInput.js";
import { ScreenContextAssistant } from "../agent/vision/ScreenContextAssistant.js";
import { ScreenMonitor } from "../agent/vision/ScreenMonitor.js";
import { ScreenSuggestionController } from "../agent/vision/ScreenSuggestionController.js";
import { ScreenSuggestionDebouncer } from "../agent/vision/ScreenSuggestionDebouncer.js";
import { ScreenPrivacyFilter } from "../agent/vision/ScreenPrivacyFilter.js";
import { ScreenOcrPipeline } from "../agent/vision/ScreenOcrPipeline.js";
import { TesseractScreenTextProvider } from "../agent/vision/TesseractScreenTextProvider.js";
import { WindowsScreenCapture } from "../agent/vision/WindowsScreenCapture.js";
import { createRequestContext } from "./observability/RequestContext.js";
import { createErrorResponse } from "./observability/ErrorResponse.js";

const runtime = await initializeAgentRuntime();
const workspace = runtime.workspace;
const { config, healthService, logger, metrics } = runtime;
const port = config.port;
const maxBodyBytes = config.maxRequestBytes;
const maxFileBytes = 20 * 1024 * 1024;
const screenAssistant = new ScreenContextAssistant();
const screenSuggestionController = new ScreenSuggestionController();
const screenSuggestionDebouncer = new ScreenSuggestionDebouncer(60_000);
const screenPrivacyFilter = new ScreenPrivacyFilter();
const screenOcrEnabled = process.platform === "win32"
  && config.screenMonitoringEnabled
  && process.env.TONI_SCREEN_OCR_ENABLED === "true";
const screenOcrProvider = screenOcrEnabled
  ? new TesseractScreenTextProvider({
      executable: process.env.TONI_TESSERACT_PATH ?? "tesseract"
    })
  : undefined;
const screenOcrPipeline = new ScreenOcrPipeline(screenPrivacyFilter, screenOcrProvider);
let latestScreenCaptureAt: string | undefined;
let latestScreenPrivacyBlocked = false;


const screenMonitor = process.platform === "win32"
  ? new ScreenMonitor(new WindowsScreenCapture(), {
      intervalMs: Number(process.env.TONI_SCREEN_INTERVAL_MS ?? 5000),
      onObservation: async (observation) => {
        const processed = await screenOcrPipeline.process(observation);
        if (!processed.observation) {
          screenSuggestionController.clear();
          latestScreenCaptureAt = observation.capturedAt;
          latestScreenPrivacyBlocked = processed.privacyBlocked;
          return;
        }
        latestScreenPrivacyBlocked = false;
        const safeObservation = processed.observation;
        const candidate = screenAssistant.analyse(safeObservation);
        if (!candidate) {
          screenSuggestionController.clear();
        } else {
          const contextKey = [
            safeObservation.activeApplication ?? "",
            safeObservation.activeWindowTitle ?? "",
            candidate.kind
          ].join("|");
          if (screenSuggestionDebouncer.shouldShow(candidate, contextKey)) {
            screenSuggestionController.publish(candidate);
          }
        }
        latestScreenCaptureAt = safeObservation.capturedAt;
      }
    })
  : undefined;

const server = createServer(async (req, res) => {
  const suppliedRequestId = typeof req.headers["x-request-id"] === "string" ? req.headers["x-request-id"] : undefined;
  const requestId = suppliedRequestId && /^[A-Za-z0-9._:-]{1,128}$/.test(suppliedRequestId) ? suppliedRequestId : createRequestContext().requestId;
  res.setHeader("x-request-id", requestId);
  metrics.requestStarted();
  const startedAt = Date.now();
  try {
    if (handleHealthRoute(req, res, runtime.state)) return;
    if (req.method === "GET" && req.url === "/metrics") {
      if (!isAuthorized(req.headers.authorization, config.authToken, config.environment)) return sendJson(res, 401, { error: "Unauthorized", requestId });
      return sendJson(res, 200, metrics.snapshot());
    }
    if (!runtime.state.isReady()) return sendJson(res, 503, { error: "Application is not ready.", phase: runtime.state.getPhase(), requestId });
    if (!isAuthorized(req.headers.authorization, config.authToken, config.environment)) {
      return sendJson(res, 401, { error: "Unauthorized" });
    }
    if (req.method === "GET" && req.url === "/") {
      const html = await readFile(resolve(workspace, "app/public/agent.html"), "utf8");
      return send(res, 200, "text/html; charset=utf-8", html);
    }
    if (req.method === "GET" && req.url === "/api/status") {
      const screenOcr = screenOcrProvider
        ? { enabled: true, ...(await screenOcrProvider.getStatus()) }
        : { enabled: false, provider: "none" as const, available: false };
      return sendJson(res, 200, {
        ...session.getState(),
        screenMonitoring: screenMonitor?.getState() ?? "off",
        screenOcr,
        screenCaptureAt: latestScreenCaptureAt,
        screenPrivacyBlocked: latestScreenPrivacyBlocked,
        screenSuggestion: screenSuggestionController.getState().suggestion,
        screenSuggestionDecision: screenSuggestionController.getState().decision
      });
    }
    if (req.method === "POST" && req.url === "/api/emergency-stop") {
      runtime.computerEmergencyStop.stop();
      return sendJson(res, 200, { stopped: true });
    }
    if (req.method === "POST" && req.url === "/api/screen/on") {
      if (!config.screenMonitoringEnabled) throw new Error("Screen monitoring is disabled by configuration.");
      if (!screenMonitor) throw new Error("Windows screen monitoring is unavailable on this operating system.");
      screenSuggestionDebouncer.reset();
      screenSuggestionController.clear();
      latestScreenPrivacyBlocked = false;
      screenMonitor.enable();
      return sendJson(res, 200, { state: screenMonitor.getState() });
    }
    if (req.method === "POST" && req.url === "/api/screen/off") {
      screenMonitor?.disable();
      screenSuggestionDebouncer.reset();
      screenSuggestionController.clear();
      latestScreenCaptureAt = undefined;
      latestScreenPrivacyBlocked = false;
      return sendJson(res, 200, { state: "off" });
    }
    if (req.method === "POST" && req.url === "/api/screen/suggestion/accept") {
      return sendJson(res, 200, screenSuggestionController.accept());
    }
    if (req.method === "POST" && req.url === "/api/screen/suggestion/dismiss") {
      return sendJson(res, 200, screenSuggestionController.dismiss());
    }
    if (req.method === "POST" && req.url === "/api/ask") {
      const body = await readRequestBody(req, maxBodyBytes);
      const form = await new Request("http://localhost/api/ask", {
        method: "POST",
        headers: { "content-type": req.headers["content-type"] ?? "application/octet-stream" },
        body: new Uint8Array(body)
      }).formData();
      const text = String(form.get("message") ?? "").trim();
      const parts: AgentContentPart[] = [];
      if (text) parts.push({ type: "input_text", text });
      let fileCount = 0;
      for (const value of form.getAll("files")) {
        if (!(value instanceof File)) continue;
        fileCount += 1;
        if (fileCount > 8) throw new Error("Liitteitä voi lähettää enintään 8 kerrallaan.");
        if (value.size > maxFileBytes) throw new Error(`Tiedosto ${value.name} on liian suuri (max 20 MB).`);
        const mediaType = safeMediaType(value.type, value.name);
        const buffer = Buffer.from(await value.arrayBuffer());
        parts.push(attachmentToContent({ filename: value.name, mediaType, size: value.size, content: buffer }));
      }
      if (parts.length === 0) throw new Error("Anna viesti tai liitä vähintään yksi tiedosto.");
      return sendJson(res, 200, await session.ask(parts, requestId));
    }
    if (req.method === "POST" && req.url === "/api/approve") {
      const body = await readJson(req);
      const actionId = typeof body.actionId === "string" ? body.actionId.trim() : "";
      if (!actionId) throw new Error("actionId puuttuu.");
      return sendJson(res, 200, { text: await session.approve(actionId, requestId), state: session.getState() });
    }
    if (req.method === "POST" && req.url === "/api/reject") {
      const body = await readJson(req);
      const actionId = typeof body.actionId === "string" ? body.actionId.trim() : "";
      if (!actionId) throw new Error("actionId puuttuu.");
      return sendJson(res, 200, { text: session.reject(actionId), state: session.getState() });
    }
    return sendJson(res, 404, { error: "Not found" });
  } catch (error: unknown) {
    metrics.requestFailed();
    const safe = createErrorResponse(error, requestId);
    logger.error("HTTP request failed.", { requestId, durationMs: Date.now() - startedAt, errorCode: safe.body.code });
    return sendJson(res, safe.statusCode, safe.body);
  }
});

const session = createInteractiveSession(runtime);
installShutdown(server, runtime);
server.once("error", (error) => {
  runtime.state.fail(error instanceof Error ? error.message : "Server failed to start.");
  runtime.database.close();
});
server.listen(port, config.host, () => {
  runtime.state.setPhase("server_ready");
  console.log(`Toni AI Agent UI: http://${config.host}:${port}`);
  console.log(`Workspace: ${workspace}`);
  console.log(`Screen monitoring: ${screenMonitor ? "available, OFF by default" : "unavailable on this OS"}`);
});

function safeMediaType(type: string, filename: string): string {
  const normalized = type.toLowerCase().trim();
  if (normalized.startsWith("image/")) return normalized;
  const ext = extname(filename).toLowerCase();
  const map: Record<string, string> = {
    ".pdf": "application/pdf", ".txt": "text/plain", ".md": "text/markdown", ".csv": "text/csv",
    ".json": "application/json", ".js": "text/javascript", ".ts": "text/plain", ".tsx": "text/plain",
    ".jsx": "text/plain", ".css": "text/css", ".html": "text/html", ".xml": "application/xml",
    ".yml": "text/plain", ".yaml": "text/plain"
  };
  return map[ext] ?? (normalized || "application/octet-stream");
}

async function readRequestBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > limit) throw new Error("Pyyntö on liian suuri.");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const body = await readRequestBody(req, 64 * 1024);
  if (!body.length) return {};
  const parsed: unknown = JSON.parse(body.toString("utf8"));
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("Virheellinen JSON-pyyntö.");
  return parsed as Record<string, unknown>;
}

function send(res: ServerResponse, status: number, contentType: string, body: string) {
  res.writeHead(status, { "content-type": contentType, "cache-control": "no-store" });
  res.end(body);
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  send(res, status, "application/json; charset=utf-8", JSON.stringify(body));
}

function isAuthorized(header: string | undefined, expected: string | undefined, environment: string): boolean {
  if (environment !== "production") return true;
  if (!header || !expected) return false;
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return false;
  const supplied = Buffer.from(header.slice(prefix.length), "utf8");
  const actual = Buffer.from(expected, "utf8");
  return supplied.length === actual.length && timingSafeEqual(supplied, actual);
}
