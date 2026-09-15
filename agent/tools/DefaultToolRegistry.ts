import { resolve } from "node:path";
import { ToolRegistry, type ToolDefinition } from "./ToolRegistry.js";
import { readTextFile } from "../../tools/filesystem/readTextFile.js";
import { writeTextFile } from "../../tools/filesystem/writeTextFile.js";
import { GitReadTool } from "../../tools/GitReadTool.js";
import { TerminalExecutor } from "../sandbox/TerminalExecutor.js";
import { createWordDocument } from "./WordDocumentTool.js";
import { browserTools } from "./BrowserTool.js";
import { WindowsComputerAdapter } from "../../computer/WindowsComputerAdapter.js";
import type { SandboxPolicy } from "../sandbox/types.js";

const readTextFileTool: ToolDefinition = {
  name: "read_text_file",
  description: "Read a UTF-8 text file inside the current workspace. Use this before proposing edits.",
  risk: "green",
  async execute(input) {
    if (typeof input !== "object" || input === null || typeof (input as { relativePath?: unknown }).relativePath !== "string") throw new Error("relativePath is required");
    return readTextFile(process.cwd(), (input as { relativePath: string }).relativePath);
  }
};

const writeTextFileTool = (workspace: string): ToolDefinition => ({
  name: "write_text_file",
  description: "Write complete UTF-8 text to a workspace-relative file. This changes project state and requires human approval.",
  risk: "yellow",
  async execute(input) {
    if (typeof input !== "object" || input === null) throw new Error("object input is required");
    const value = input as { relativePath?: unknown; content?: unknown };
    if (typeof value.relativePath !== "string") throw new Error("relativePath is required");
    if (typeof value.content !== "string") throw new Error("content is required");
    return writeTextFile(workspace, value.relativePath, value.content);
  }
});

const writeWordDocumentTool = (workspace: string): ToolDefinition => ({
  name: "write_word_document",
  description: "Create a real Microsoft Word .docx file inside the workspace. Writing the document changes project state and requires human approval.",
  risk: "yellow",
  async execute(input) {
    if (typeof input !== "object" || input === null) throw new Error("object input is required");
    const value = input as { relativePath?: unknown; title?: unknown; content?: unknown };
    if (typeof value.relativePath !== "string") throw new Error("relativePath is required");
    if (value.title !== undefined && typeof value.title !== "string") throw new Error("title must be a string");
    if (typeof value.content !== "string") throw new Error("content is required");
    const documentInput: { relativePath: string; content: string; title?: string } = { relativePath: value.relativePath, content: value.content };
    if (typeof value.title === "string") documentInput.title = value.title;
    return createWordDocument(workspace, documentInput);
  }
});

const runCommandTool = (workspace: string): ToolDefinition => ({
  name: "run_command",
  description: "Run an allowlisted development command inside the workspace. Read/check commands are green; writes or destructive commands are still supervised by the permission engine.",
  risk: "yellow",
  async execute(input) {
    if (typeof input !== "object" || input === null) throw new Error("object input is required");
    const value = input as { command?: unknown };
    if (typeof value.command !== "string" || !value.command.trim()) throw new Error("command is required");
    const policy: SandboxPolicy = {
      workspaceRoot: workspace,
      network: "deny",
      maxExecutionMs: 30000,
      maxOutputBytes: 200000,
      allowCommands: ["node", "npm", "npx", "pnpm", "yarn", "git", "tsc", "tsx", "python", "python3"],
      denyPatterns: ["rm -rf /", "rm -rf *", "format ", "format.com", "del /s /q", "shutdown", "reboot", "mkfs", "diskpart", "reg delete", "cipher /w"]
    };
    return new TerminalExecutor({ policy }).run({ command: value.command, cwd: workspace });
  }
});

const computerTools = (computer = new WindowsComputerAdapter()): ToolDefinition[] => [
  {
    name: "computer_click",
    description: "Click the Windows desktop at screen coordinates. Human approval is required.",
    risk: "yellow",
    async execute(input) {
      if (typeof input !== "object" || input === null) throw new Error("object input is required");
      const value = input as { x?: unknown; y?: unknown };
      if (typeof value.x !== "number" || typeof value.y !== "number") throw new Error("x and y are required");
      await computer.click(value.x, value.y);
      return { ok: true, x: value.x, y: value.y };
    }
  },
  {
    name: "computer_type",
    description: "Type text into the currently focused Windows application. Human approval is required; credential and authentication-code entry is blocked.",
    risk: "yellow",
    async execute(input) {
      if (typeof input !== "object" || input === null || typeof (input as { text?: unknown }).text !== "string") throw new Error("text is required");
      await computer.type((input as { text: string }).text);
      return { ok: true };
    }
  },
  {
    name: "computer_keypress",
    description: "Send a bounded non-system key sequence to the focused Windows application. Human approval is required.",
    risk: "yellow",
    async execute(input) {
      if (typeof input !== "object" || input === null || typeof (input as { key?: unknown }).key !== "string") throw new Error("key is required");
      await computer.keypress((input as { key: string }).key);
      return { ok: true };
    }
  }
];

export function createDefaultToolRegistry(workspace: string): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register({ ...readTextFileTool, execute: async (input) => {
    if (typeof input !== "object" || input === null || typeof (input as { relativePath?: unknown }).relativePath !== "string") throw new Error("relativePath is required");
    return readTextFile(workspace, (input as { relativePath: string }).relativePath);
  }});
  registry.register(writeTextFileTool(workspace));
  registry.register(writeWordDocumentTool(workspace));
  registry.register(runCommandTool(workspace));
  for (const tool of browserTools(workspace)) registry.register(tool);
  for (const tool of computerTools()) registry.register(tool);

  const git = new GitReadTool();
  registry.register({
    name: git.name,
    description: git.description,
    risk: git.risk,
    execute: async (input) => {
      if (typeof input !== "object" || input === null || !Array.isArray((input as { args?: unknown }).args)) throw new Error("args array is required");
      const args = (input as { args: unknown[] }).args;
      if (!args.every((arg): arg is string => typeof arg === "string")) throw new Error("git args must be strings");
      return git.execute({ cwd: resolve(workspace), args });
    }
  });
  return registry;
}

export function defaultFunctionToolSpecs(): Array<{ name: string; description: string; parameters: Record<string, unknown>; risk: "green" | "yellow" | "red" }> {
  return [
    { name: "read_text_file", description: "Read a UTF-8 text file inside the current workspace.", risk: "green", parameters: { type: "object", properties: { relativePath: { type: "string", description: "Workspace-relative file path" } }, required: ["relativePath"], additionalProperties: false } },
    { name: "write_text_file", description: "Write complete UTF-8 text to a workspace-relative file. Human approval is required.", risk: "yellow", parameters: { type: "object", properties: { relativePath: { type: "string", description: "Workspace-relative file path" }, content: { type: "string", description: "Complete replacement file content" } }, required: ["relativePath", "content"], additionalProperties: false } },
    { name: "write_word_document", description: "Create a real Microsoft Word .docx file inside the workspace. Human approval is required.", risk: "yellow", parameters: { type: "object", properties: { relativePath: { type: "string", description: "Workspace-relative .docx output path" }, title: { type: "string", description: "Optional Word document title" }, content: { type: "string", description: "Document text; use line breaks for separate paragraphs" } }, required: ["relativePath", "content"], additionalProperties: false } },
    { name: "run_command", description: "Run an allowlisted development command inside the workspace. Human approval is required until command policy is explicitly refined.", risk: "yellow", parameters: { type: "object", properties: { command: { type: "string", description: "Allowlisted development command" } }, required: ["command"], additionalProperties: false } },
    { name: "browser_tabs", description: "List tabs in the isolated browser session.", risk: "green", parameters: { type: "object", properties: {}, additionalProperties: false } },
    { name: "browser_open", description: "Open a new isolated browser tab at an http/https URL.", risk: "green", parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"], additionalProperties: false } },
    { name: "browser_observe", description: "Read visible page text and a current screenshot from a browser tab.", risk: "green", parameters: { type: "object", properties: { tabId: { type: "string" }, screenshot: { type: "boolean" } }, required: ["tabId"], additionalProperties: false } },
    { name: "browser_click", description: "Click an element in a browser tab. Human approval is required.", risk: "yellow", parameters: { type: "object", properties: { tabId: { type: "string" }, selector: { type: "string" } }, required: ["tabId", "selector"], additionalProperties: false } },
    { name: "browser_type", description: "Fill a form field in a browser tab. Human approval is required.", risk: "yellow", parameters: { type: "object", properties: { tabId: { type: "string" }, selector: { type: "string" }, text: { type: "string" } }, required: ["tabId", "selector", "text"], additionalProperties: false } },
    { name: "browser_navigate", description: "Navigate an existing browser tab. Human approval is required.", risk: "yellow", parameters: { type: "object", properties: { tabId: { type: "string" }, url: { type: "string" } }, required: ["tabId", "url"], additionalProperties: false } },
    { name: "computer_click", description: "Click the Windows desktop at screen coordinates. Human approval is required.", risk: "yellow", parameters: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"], additionalProperties: false } },
    { name: "computer_type", description: "Type text into the focused Windows application. Human approval is required; credential entry is blocked.", risk: "yellow", parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"], additionalProperties: false } },
    { name: "computer_keypress", description: "Send a bounded non-system key sequence. Human approval is required.", risk: "yellow", parameters: { type: "object", properties: { key: { type: "string" } }, required: ["key"], additionalProperties: false } },
    { name: "git_read", description: "Read Git status, diff, log, branch, show or remote information without modifying the repository.", risk: "green", parameters: { type: "object", properties: { args: { type: "array", items: { type: "string" } } }, required: ["args"], additionalProperties: false } }
  ];
}
