import { chromium, type BrowserContext, type Page } from "playwright";
import type { BrowserAdapter, BrowserSession } from "./BrowserAdapter.js";

export class PlaywrightBrowserAdapter implements BrowserAdapter {
  private readonly pages = new Map<string, { context: BrowserContext; page: Page }>();

  async open(url: string, session: BrowserSession): Promise<void> {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error("Only HTTP(S) URLs are allowed");
    const context = await chromium.launchPersistentContext(session.profilePath, { headless: false });
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    this.pages.set(session.id, { context, page });
  }

  private get(session: BrowserSession): { context: BrowserContext; page: Page } {
    const item = this.pages.get(session.id); if (!item) throw new Error("Browser session is not open"); return item;
  }
  async read(session: BrowserSession) { const { page } = this.get(session); return { title: await page.title(), url: page.url(), text: await page.locator("body").innerText() }; }
  async click(session: BrowserSession, selector: string): Promise<void> { await this.get(session).page.locator(selector).click(); }
  async type(session: BrowserSession, selector: string, value: string): Promise<void> { await this.get(session).page.locator(selector).fill(value); }
  async submit(session: BrowserSession, selector: string): Promise<void> { await this.get(session).page.locator(selector).click(); }
  async close(session: BrowserSession): Promise<void> { const item = this.pages.get(session.id); if (item) { await item.context.close(); this.pages.delete(session.id); } }
}
