import { resolve } from "node:path";
import { ToolRegistry, type ToolDefinition } from "./ToolRegistry.js";
import { readTextFile } from "../../tools/filesystem/readTextFile.js";
import { GitReadTool } from "../../tools/GitReadTool.js";

const readTextFileTool: ToolDefinition = {
  name: "read_text_file",
  description: "Read a UTF-8 text file inside the current workspace. Use this before proposing edits.",
  risk: "green",
  async execute(input) {
    if (typeof input !== "object" || input === null || typeof (input as { relativePath?: unknown }).relativePath !== "string") {
      throw new Error("relativePath is required");
    }
    const relativePath = (input as { relativePath: string }).relativePath;
    return readTextFile(process.cwd(), relativePath);
  }
};

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
