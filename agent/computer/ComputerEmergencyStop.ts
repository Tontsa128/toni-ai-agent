export class ComputerEmergencyStop {
  private stopped = false;

  stop(): void {
    this.stopped = true;
  }

  isStopped(): boolean {
    return this.stopped;
  }

  assertRunning(): void {
    if (this.stopped) throw new Error("Computer control is stopped by the emergency stop.");
  }
}
