export interface ComputerAdapter {
  screenshot(): Promise<string>;
  click(x: number, y: number): Promise<void>;
  type(text: string): Promise<void>;
  keypress(key: string): Promise<void>;
}

export class ComputerPolicy {
  static assertSafeCoordinate(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0) throw new Error("Invalid screen coordinate");
  }
}

/** Computer control is approval-gated. No credential entry, MFA bypass or security-control bypass is implemented. */
