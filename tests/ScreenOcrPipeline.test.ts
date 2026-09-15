import assert from "node:assert/strict";
import test from "node:test";
import { ScreenOcrPipeline } from "../agent/vision/ScreenOcrPipeline.js";
import { ScreenPrivacyFilter } from "../agent/vision/ScreenPrivacyFilter.js";
import type { ScreenTextProvider } from "../agent/vision/ScreenTextProvider.js";

const observation = {
  capturedAt: new Date().toISOString(),
  monitorId: "virtual-screen",
  imageDataUrl: "data:image/png;base64,ZmFrZQ==",
  activeApplication: "Chrome",
  activeWindowTitle: "Tehtävänanto"
};

class FakeProvider implements ScreenTextProvider {
  public calls = 0;
  constructor(private readonly text: string | undefined) {}
  async extractText(): Promise<string | undefined> {
    this.calls += 1;
    return this.text;
  }
}

test("OCR pipeline blocks credential windows before OCR", async () => {
  const provider = new FakeProvider("should-not-be-read");
  const pipeline = new ScreenOcrPipeline(new ScreenPrivacyFilter(), provider);
  const result = await pipeline.process({ ...observation, activeWindowTitle: "Password manager" });
  assert.equal(result.privacyBlocked, true);
  assert.equal(result.observation, undefined);
  assert.equal(provider.calls, 0);
});

test("OCR pipeline enriches safe observations and strips the raw image", async () => {
  const provider = new FakeProvider("Liiketoimintasuunnitelma tehtävä");
  const pipeline = new ScreenOcrPipeline(new ScreenPrivacyFilter(), provider);
  const result = await pipeline.process(observation);
  assert.equal(result.privacyBlocked, false);
  assert.equal(result.observation?.visibleText, "Liiketoimintasuunnitelma tehtävä");
  assert.equal("imageDataUrl" in (result.observation ?? {}), false);
  assert.equal(provider.calls, 1);
});

test("OCR text containing a privacy signal is blocked after OCR", async () => {
  const provider = new FakeProvider("Please enter password now");
  const pipeline = new ScreenOcrPipeline(new ScreenPrivacyFilter(), provider);
  const result = await pipeline.process(observation);
  assert.equal(result.privacyBlocked, true);
  assert.equal(result.observation, undefined);
});
