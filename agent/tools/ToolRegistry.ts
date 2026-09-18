export type ToolRisk = "green" | "yellow" | "red";
export interface ToolExecutionContext { sessionId: string; signal: AbortSignal; }

export interface ToolDefinition<Input = unknown, Output = unknown> {
  name: string;
  description: string;
  risk: ToolRisk;
  validateInput?: (input: unknown) => Input;
  execute(input: Input, context?: ToolExecutionContext): Promise<Output>;
}

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();
  register(tool: ToolDefinition): void {
    if (!/^[a-z][a-z0-9_]{1,63}$/.test(tool.name)) throw new Error(`Invalid tool name: ${tool.name}`);
    if (this.tools.has(tool.name)) throw new Error(`Tool already registered: ${tool.name}`);
    this.tools.set(tool.name, tool);
  }
  getRisk(name: string): ToolRisk {\n    return this.get(name).risk;\n  }\n\n  get(name: string): ToolDefinition {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool not found: ${name}`);
    return tool;
  }
  list(): ToolDefinition[] { return [...this.tools.values()]; }
  has(name: string): boolean { return this.tools.has(name); }
}
