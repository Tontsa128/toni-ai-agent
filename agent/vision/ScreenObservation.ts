export type ScreenMonitoringState = "off" | "on";

export interface ScreenRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenObservation {
  capturedAt: string;
  monitorId: string;
  imageDataUrl?: string;
  activeWindowTitle?: string;
  activeApplication?: string;
  visibleText?: string;
  region?: ScreenRegion;
}

/**
 * Privacy-first screen monitoring contract.
 * The monitor is explicitly off until the user enables it. Implementations
 * must not capture, OCR, upload or retain screen data while disabled.
 */
export class ScreenObservationGate {
  private state: ScreenMonitoringState = "off";

  getState(): ScreenMonitoringState {
    return this.state;
  }

  enable(): void {
    this.state = "on";
  }

  disable(): void {
    this.state = "off";
  }

  assertEnabled(): void {
    if (this.state !== "on") throw new Error("Screen monitoring is disabled by the user");
  }
}
