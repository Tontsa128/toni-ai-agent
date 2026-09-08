import type { ExecutionRequest, ExecutionResult } from "../agent/sandbox/types.js";
import type { TerminalExecutor } from "../agent/sandbox/TerminalExecutor.js";

export class TerminalTool {
  constructor(private readonly executor: TerminalExecutor) {}
  run(request: ExecutionRequest): Promise<ExecutionResult> { return this.executor.run(request); }
}
