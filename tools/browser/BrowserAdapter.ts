export interface BrowserSession {
  id: string;
  profilePath: string;
  authenticatedByUser: boolean;
}

export interface BrowserAdapter {
  open(url: string, session: BrowserSession): Promise<void>;
  read(session: BrowserSession): Promise<{ title: string; url: string; text: string }>;
  click(session: BrowserSession, selector: string): Promise<void>;
  type(session: BrowserSession, selector: string, value: string): Promise<void>;
  submit(session: BrowserSession, selector: string): Promise<void>;
  close(session: BrowserSession): Promise<void>;
}

/** Browser actions must run through the supervisor; authentication and MFA stay user-controlled. */
export class BrowserPolicy {
  static validateUrl(url: string): void {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error("Only HTTP(S) browser URLs are allowed");
  }
}
