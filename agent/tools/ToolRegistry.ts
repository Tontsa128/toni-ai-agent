export interface ToolDefinition<Input = unknown, Output = unknown> {
  name: string;
  description: string;
  risk: "green" | "yellow" | "red";
  execute(input: Input): Promise<Output>;
}

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();
  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) throw new Error(`Tool already registered: ${tool.name}`);
    this.tools.set(tool.name, tool);
  }
  get(name: string): ToolDefinition { const tool = this.tools.get(name); if (!tool) throw new Error(`Tool not found: ${name}`); return tool; }
  list(): ToolDefinition[] { return [...this.tools.values()]; }
}
