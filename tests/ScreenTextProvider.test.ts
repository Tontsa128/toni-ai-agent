import assert from "node:assert/strict";
import test from "node:test";
import { enrichScreenObservation, type ScreenTextProvider } from "../agent/vision/ScreenTextProvider.js";

const base = {
  capturedAt: new Date().toISOString(),
  monitorId: "primary",
  imageDataUrl: "data:image/png;base64,ZmFrZQ==",
  activeApplication: "Chrome"
};

class FakeTextProvider implements ScreenTextProvider {
  constructor(private readonly text: string | undefined) {}

  async extractText(): Promise<string | undefined> {
    return this.text;
  }
}

test("enrichScreenObservation adds OCR text without changing capture metadata", async () => {
  const result = await enrichScreenObservation(base, new FakeTextProvider("Liiketoimintasuunnitelma"));
  assert.equal(result.visibleText, "Liiketoimintasuunnitelma");
  assert.equal(result.activeApplication, "Chrome");
  assert.equal(result.imageDataUrl, base.imageDataUrl);
});

test("enrichScreenObservation leaves observation unchanged when OCR has no text", async () => {
  const result = await enrichScreenObservation(base, new FakeTextProvider("   "));
  assert.deepEqual(result, base);
});
