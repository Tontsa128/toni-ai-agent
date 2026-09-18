export class SessionLock {
  private active = false;
  async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    if (this.active) throw new Error("Session already has an active operation.");
    this.active = true;
    try { return await operation(); } finally { this.active = false; }
  }
  isActive(): boolean { return this.active; }
}
