import { createDefaultToolRegistry, type DefaultToolRegistryOptions } from "./DefaultToolRegistry.js";
import type { ToolRegistry } from "./ToolRegistry.js";

/** Single bootstrap entry point for the production tool set. */
export function registerAllTools(
  registry: ToolRegistry,
  workspace: string,
  options: DefaultToolRegistryOptions = {}
): void {
  for (const tool of createDefaultToolRegistry(workspace, options).list()) registry.register(tool);
}
