import { resolve } from "node:path";
import { ToolRegistry, type ToolDefinition } from "./ToolRegistry.js";
import { readTextFile } from "../../tools/filesystem/readTextFile.js";
import { writeTextFile } from "../../tools/filesystem/writeTextFile.js";
import { GitReadTool } from "../../tools/GitReadTool.js";
import { TerminalExecutor } from "../sandbox/TerminalExecutor.js";
import { createWordDocument } from "./WordDocumentTool.js";
import type { SandboxPolicy } from "../sandbox/types.js";

const readTextFileTool: ToolDefinition = {
  name: "read_text_file",
  description: "Read a UTF-8 text file inside the current workspace. Use this before proposing edits.",
  risk: "green",
  async execute(input) {
    if (typeof input !== "object" || input === null || typeof (input as { relativePath?: unknown }).relativePath !== "string") {
      throw new Error("relativePath is required");
    }
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
    const documentInput: { relativePath: string; content: string; title?: string } = {
      relativePath: value.relativePath,
      content: value.content
    };
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
    const executor = new TerminalExecutor({ policy });
    const result = await executor.run({ command: value.command, cwd: workspace });
    return result;
  }
});

export function createDefaultToolRegistry(workspace: string): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register({
    ...readTextFileTool,
    execute: async (input) => {
      if (typeof input !== "object" || input === null || typeof (input as { relativePath?: unknown }).relativePath !== "string") {
        throw new Error("relativePath is required");
      }
      return readTextFile(workspace, (input as { relativePath: string }).relativePath);
    }
  });
  registry.register(writeTextFileTool(workspace));
  registry.register(writeWordDocumentTool(workspace));
  registry.register(runCommandTool(workspace));

  const git = new GitReadTool();
  registry.register({
    name: git.name,
    description: git.description,
    risk: git.risk,
    execute: async (input) => {
      if (typeof input !== "object" || input === null || !Array.isArray((input as { args?: unknown }).args)) {
        throw new Error("args array is required");
      }
      const args = (input as { args: unknown[] }).args;
      if (!args.every((arg): arg is string => typeof arg === "string")) throw new Error("git args must be strings");
      return git.execute({ cwd: resolve(workspace), args });
    }
  });
  return registry;
}

export function defaultFunctionToolSpecs(): Array<{
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  risk: "green" | "yellow" | "red";
}> {
  return [
    {
      name: "read_text_file",
      description: "Read a UTF-8 text file inside the current workspace.",
      risk: "green",
      parameters: {
        type: "object",
        properties: { relativePath: { type: "string", description: "Workspace-relative file path" } },
        required: ["relativePath"],
        additionalProperties: false
      }
    },
    {
      name: "write_text_file",
      description: "Write complete UTF-8 text to a workspace-relative file. Human approval is required.",
      risk: "yellow",
      parameters: {
        type: "object",
        properties: {
          relativePath: { type: "string", description: "Workspace-relative file path" },
          content: { type: "string", description: "Complete replacement file content" }
        },
        required: ["relativePath", "content"],
        additionalProperties: false
      }
    },
    {
      name: "write_word_document",
      description: "Create a real Microsoft Word .docx file inside the workspace. Human approval is required.",
      risk: "yellow",
      parameters: {
        type: "object",
        properties: {
          relativePath: { type: "string", description: "Workspace-relative .docx output path" },
          title: { type: "string", description: "Optional Word document title" },
          content: { type: "string", description: "Document text; use line breaks for separate paragraphs" }
        },
        required: ["relativePath", "content"],
        additionalProperties: false
      }
    },
    {
      name: "run_command",
      description: "Run an allowlisted development command inside the workspace. Human approval is required until command policy is explicitly refined.",
      risk: "yellow",
      parameters: {
        type: "object",
        properties: { command: { type: "string", description: "Allowlisted development command" } },
        required: ["command"],
        additionalProperties: false
      }
    },
    {
      name: "git_read",
      description: "Read Git status, diff, log, branch, show or remote information without modifying the repository.",
      risk: "green",
      parameters: {
        type: "object",
        properties: {
          args: { type: "array", items: { type: "string" }, description: "Read-only git arguments, for example [\"status\", \"--short\"]" }
        },
        required: ["args"],
        additionalProperties: false
      }
    }
  ];
}
