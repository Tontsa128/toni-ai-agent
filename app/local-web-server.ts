import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { createInteractiveSession, initializeAgentRuntime } from "./startup.js";
import { attachmentToContent, type AgentContentPart } from "./AgentInput.js";
import { ScreenContextAssistant } from "../agent/vision/ScreenContextAssistant.js";
import { ScreenMonitor } from "../agent/vision/ScreenMonitor.js";
import { ScreenSuggestionController } from "../agent/vision/ScreenSuggestionController.js";
import { ScreenSuggestionDebouncer } from "../agent/vision/ScreenSuggestionDebouncer.js";
import { ScreenPrivacyFilter } from "../agent/vision/ScreenPrivacyFilter.js";
import { ScreenOcrPipeline } from "../agent/vision/ScreenOcrPipeline.js";
import { TesseractScreenTextProvider } from "../agent/vision/TesseractScreenTextProvider.js";
import { WindowsScreenCapture } from "../agent/vision/WindowsScreenCapture.js";

const workspace = process.cwd();
const runtime = await initializeAgentRuntime(workspace);
const { config, healthService } = runtime;
const port = config.port;
const maxBodyBytes = config.maxRequestBytes;
const maxFileBytes = 20 * 1024 * 1024;
const screenAssistant = new ScreenContextAssistant();
const screenSuggestionController = new ScreenSuggestionController();
const screenSuggestionDebouncer = new ScreenSuggestionDebouncer(60_000);
const screenPrivacyFilter = new ScreenPrivacyFilter();
const screenOcrEnabled = process.platform === "win32" && process.env.TONI_SCREEN_OCR_ENABLED !== "0";
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
  try {
    if (req.method === "GET" && req.url === "/") {
      const html = await readFile(resolve(workspace, "app/public/agent.html"), "utf8");
      return send(res, 200, "text/html; charset=utf-8", html);
    }
    if (req.method === "GET" && req.url === "/health") {
      const health = healthService.getStatus();
      return sendJson(res, health.status === "ok" ? 200 : 503, health);
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
    if (req.method === "POST" && req.url === "/api/screen/on") {
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
      return sendJson(res, 200, await session.ask(parts));
    }
    if (req.method === "POST" && req.url === "/api/approve") {
      const body = await readJson(req);
      const actionId = typeof body.actionId === "string" ? body.actionId.trim() : "";
      if (!actionId) throw new Error("actionId puuttuu.");
      return sendJson(res, 200, { text: await session.approve(actionId), state: session.getState() });
    }
    if (req.method === "POST" && req.url === "/api/reject") {
      const body = await readJson(req);
      const actionId = typeof body.actionId === "string" ? body.actionId.trim() : "";
      if (!actionId) throw new Error("actionId puuttuu.");
      return sendJson(res, 200, { text: session.reject(actionId), state: session.getState() });
    }
    return sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    return sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
  }
});

const session = createInteractiveSession(runtime);

server.listen(port, config.host, () => {
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
    if (size > limit) throw new Error("Pyyntö on liian suuri (max 30 MB).");
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
