import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { loadPolicy } from "../tools/config.js";
import { InteractiveSession } from "./InteractiveSession.js";
import { attachmentToContent, type AgentContentPart } from "./AgentInput.js";

const workspace = process.cwd();
const policy = await loadPolicy(workspace);
const session = new InteractiveSession({ workspace, policy });
const port = Number(process.env.TONI_AI_PORT ?? 8787);
const maxBodyBytes = 30 * 1024 * 1024;
const maxFileBytes = 20 * 1024 * 1024;

const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/") {
      const html = await readFile(resolve(workspace, "app/public/agent.html"), "utf8");
      return send(res, 200, "text/html; charset=utf-8", html);
    }
    if (req.method === "GET" && req.url === "/api/status") return sendJson(res, 200, session.getState());
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

server.listen(port, "127.0.0.1", () => {
  console.log(`Toni AI Agent UI: http://127.0.0.1:${port}`);
  console.log(`Workspace: ${workspace}`);
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
