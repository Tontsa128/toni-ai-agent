export type StartupPhase =
  | "created" | "config_loaded" | "storage_ready" | "tools_ready"
  | "providers_ready" | "sandbox_ready" | "server_ready"
  | "failed" | "stopping" | "stopped";

export class StartupState {
  private phase: StartupPhase = "created";
  private failure?: string;
  public setPhase(next: StartupPhase): void {
    if (this.phase === "failed" || this.phase === "stopped") throw new Error("Cannot transition from " + this.phase + ".");
    this.phase = next;
  }
  public fail(reason: string): void { this.phase = "failed"; this.failure = reason; }
  public getPhase(): StartupPhase { return this.phase; }
  public getFailure(): string | undefined { return this.failure; }
  public isReady(): boolean { return this.phase === "server_ready"; }
  public isStopping(): boolean { return this.phase === "stopping"; }
}