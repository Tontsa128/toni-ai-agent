import assert from "node:assert/strict";
import test from "node:test";
import { ScreenPrivacyFilter } from "../agent/vision/ScreenPrivacyFilter.js";

const base = {
  capturedAt: new Date().toISOString(),
  monitorId: "primary",
  imageDataUrl: "data:image/png;base64,secret-image",
  activeApplication: "Chrome"
};

test("ScreenPrivacyFilter blocks credential-related screen content", () => {
  const filter = new ScreenPrivacyFilter();
  assert.equal(filter.filter({ ...base, activeWindowTitle: "Password manager", visibleText: "Account" }), undefined);
  assert.equal(filter.filter({ ...base, activeWindowTitle: "Normal page", visibleText: "API key: abc" }), undefined);
});

test("ScreenPrivacyFilter removes raw screenshot data before downstream analysis", () => {
  const filter = new ScreenPrivacyFilter();
  const result = filter.filter({ ...base, activeWindowTitle: "School task", visibleText: "Liiketoimintasuunnitelma" });
  assert.ok(result);
  assert.equal(result.imageDataUrl, undefined);
  assert.equal(result.visibleText, "Liiketoimintasuunnitelma");
});
