import type { ScreenObservation } from "./ScreenObservation.js";
import { ScreenObservationGate } from "./ScreenObservation.js";

export interface ScreenCaptureProvider { capture(): Promise<ScreenObservation>; }

export interface ScreenMonitorOptions {
  intervalMs?: number;
  onObservation?: (observation: ScreenObservation) => Promise<void> | void;
}

/** Privacy-first monitor: capture starts only after explicit user enable(). */
export class ScreenMonitor {
  private readonly gate = new ScreenObservationGate();
  private readonly intervalMs: number;
  private readonly onObservation: ((observation: ScreenObservation) => Promise<void> | void) | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;
  private captureInFlight = false;

  constructor(private readonly provider: ScreenCaptureProvider, options: ScreenMonitorOptions = {}) {
    this.intervalMs = Math.max(1000, Math.min(60000, options.intervalMs ?? 3000));
    this.onObservation = options.onObservation;
  }

  getState() { return this.gate.getState(); }

  enable(): void {
    if (this.gate.getState() === "on") return;
    this.gate.enable();
    this.timer = setInterval(() => { void this.tick(); }, this.intervalMs);
    void this.tick();
  }

  disable(): void {
    this.gate.disable();
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  async captureNow(): Promise<ScreenObservation> {
    this.gate.assertEnabled();
    return this.provider.capture();
  }

  private async tick(): Promise<void> {
    if (this.gate.getState() !== "on" || this.captureInFlight) return;
    this.captureInFlight = true;
    try {
      const observation = await this.captureNow();
      if (this.gate.getState() === "on") await this.onObservation?.(observation);
    } finally {
      this.captureInFlight = false;
    }
  }
}
