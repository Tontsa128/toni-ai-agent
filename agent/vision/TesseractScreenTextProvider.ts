import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { ScreenObservation } from "./ScreenObservation.js";
import type { ScreenTextProvider } from "./ScreenTextProvider.js";

const execFileAsync = promisify(execFile);

export interface TesseractScreenTextProviderOptions {
  executable?: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
}

/** Optional local OCR adapter. It never enables screen monitoring itself. */
export class TesseractScreenTextProvider implements ScreenTextProvider {
  private readonly executable: string;
  private readonly timeoutMs: number;
  private readonly maxOutputBytes: number;

  constructor(options: TesseractScreenTextProviderOptions = {}) {
    this.executable = options.executable ?? "tesseract";
    this.timeoutMs = Math.max(1000, options.timeoutMs ?? 10_000);
    this.maxOutputBytes = Math.max(1024, options.maxOutputBytes ?? 256 * 1024);
  }

  async extractText(observation: ScreenObservation): Promise<string | undefined> {
    const imageDataUrl = observation.imageDataUrl;
    if (!imageDataUrl?.startsWith("data:image/")) return undefined;

    const comma = imageDataUrl.indexOf(",");
    if (comma < 0) return undefined;
    const encoded = imageDataUrl.slice(comma + 1);
    if (!encoded) return undefined;

    const filePath = join(tmpdir(), `toni-ai-ocr-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.png`);
    try {
      await fs.writeFile(filePath, Buffer.from(encoded, "base64"), { mode: 0o600 });
      const { stdout } = await execFileAsync(this.executable, [filePath, "stdout", "-l", "eng+fin", "--psm", "6"], {
        windowsHide: true,
        shell: false,
        timeout: this.timeoutMs,
        maxBuffer: this.maxOutputBytes
      });
      const text = stdout.trim();
      return text || undefined;
    } catch {
      // OCR is an optional enrichment stage. Missing Tesseract or an OCR failure
      // must never break screen monitoring or the rest of the agent.
      return undefined;
    } finally {
      await fs.rm(filePath, { force: true }).catch(() => undefined);
    }
  }
}
