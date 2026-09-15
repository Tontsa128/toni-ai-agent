import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

export interface BrowserTabSnapshot {
  id: string;
  url: string;
  title: string;
}

export interface BrowserObservation extends BrowserTabSnapshot {
  text: string;
  screenshotDataUrl?: string;
}

export interface BrowserControllerOptions {
  maxTabs?: number;
  navigationTimeoutMs?: number;
}

/** Local Playwright controller with an isolated browser context. */
export class BrowserController {
  private readonly maxTabs: number;
  private readonly navigationTimeoutMs: number;
  private browser: Browser | undefined;
  private context: BrowserContext | undefined;
  private readonly pages = new Map<string, Page>();
  private nextTab = 1;

  constructor(options: BrowserControllerOptions = {}) {
    this.maxTabs = Math.max(1, Math.min(8, options.maxTabs ?? 6));
    this.navigationTimeoutMs = Math.max(1000, Math.min(120000, options.navigationTimeoutMs ?? 30000));
  }

  async start(): Promise<void> {
    if (this.context) return;
    this.browser = await chromium.launch({ headless: true });
    this.context = await this.browser.newContext({ serviceWorkers: "block", acceptDownloads: false });
    this.registerPage(await this.context.newPage());
  }

  async stop(): Promise<void> {
    this.pages.clear();
    await this.context?.close();
    await this.browser?.close();
    this.context = undefined;
    this.browser = undefined;
  }

  async newTab(url?: string): Promise<BrowserTabSnapshot> {
    await this.start();
    if (this.pages.size >= this.maxTabs) throw new Error(`Maximum browser tabs reached (${this.maxTabs})`);
    const id = this.registerPage(await this.context!.newPage());
    if (url !== undefined) await this.navigate(id, url);
    return this.snapshot(id);
  }

  async navigate(id: string, url: string): Promise<BrowserTabSnapshot> {
    const page = this.getPage(id);
    this.assertSafeUrl(url);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: this.navigationTimeoutMs });
    return this.snapshot(id);
  }

  async observe(id: string, screenshot = true): Promise<BrowserObservation> {
    const page = this.getPage(id);
    const result: BrowserObservation = {
      ...await this.snapshot(id),
      text: (await page.locator("body").innerText({ timeout: this.navigationTimeoutMs })).slice(0, 50000)
    };
    if (screenshot) {
      const bytes = await page.screenshot({ type: "png", fullPage: false });
      result.screenshotDataUrl = `data:image/png;base64,${bytes.toString("base64")}`;
    }
    return result;
  }

  async click(id: string, selector: string): Promise<BrowserTabSnapshot> {
    const page = this.getPage(id);
    this.assertSelector(selector);
    await page.locator(selector).first().click({ timeout: this.navigationTimeoutMs });
    return this.snapshot(id);
  }

  async type(id: string, selector: string, text: string): Promise<BrowserTabSnapshot> {
    const page = this.getPage(id);
    this.assertSelector(selector);
    if (text.length > 10000) throw new Error("Browser input is limited to 10,000 characters");
    await page.locator(selector).first().fill(text, { timeout: this.navigationTimeoutMs });
    return this.snapshot(id);
  }

  async tabs(): Promise<BrowserTabSnapshot[]> {
    await this.start();
    return Promise.all([...this.pages.keys()].map((id) => this.snapshot(id)));
  }

  async closeTab(id: string): Promise<void> {
    const page = this.getPage(id);
    await page.close();
    this.pages.delete(id);
  }

  private registerPage(page: Page): string {
    const id = `tab-${this.nextTab++}`;
    this.pages.set(id, page);
    return id;
  }

  private getPage(id: string): Page {
    const page = this.pages.get(id);
    if (!page) throw new Error(`Browser tab not found: ${id}`);
    return page;
  }

  private async snapshot(id: string): Promise<BrowserTabSnapshot> {
    const page = this.getPage(id);
    return { id, url: page.url(), title: await page.title().catch(() => "") };
  }

  private assertSafeUrl(url: string): void {
    let parsed: URL;
    try { parsed = new URL(url); } catch { throw new Error("Invalid browser URL"); }
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Only http/https browser URLs are allowed");
    if (parsed.username || parsed.password) throw new Error("Embedded browser credentials are not allowed");
  }

  private assertSelector(selector: string): void {
    if (!selector.trim()) throw new Error("Browser selector is required");
    if (selector.length > 1000) throw new Error("Browser selector is too long");
  }
}
