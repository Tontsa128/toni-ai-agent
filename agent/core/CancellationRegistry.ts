export class CancellationRegistry {
  private readonly controllers = new Map<string, AbortController>();
  create(operationId: string): AbortSignal {
    if (this.controllers.has(operationId)) throw new Error(`Operation already exists: ${operationId}`);
    const controller = new AbortController();
    this.controllers.set(operationId, controller);
    return controller.signal;
  }
  cancel(operationId: string): boolean {
    const controller = this.controllers.get(operationId);
    if (!controller) return false;
    controller.abort(new Error("Operation cancelled by user."));
    this.controllers.delete(operationId);
    return true;
  }
  remove(operationId: string): void { this.controllers.delete(operationId); }
  clear(): void {
    for (const controller of this.controllers.values()) controller.abort(new Error("All operations cancelled."));
    this.controllers.clear();
  }
  has(operationId: string): boolean { return this.controllers.has(operationId); }
}
