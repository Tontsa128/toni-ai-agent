import assert from "node:assert/strict";
import test from "node:test";
import { ScreenContextAssistant } from "../agent/vision/ScreenContextAssistant.js";

test("ScreenContextAssistant suggests a plan for business-study instructions", () => {
  const assistant = new ScreenContextAssistant();
  const suggestion = assistant.analyse({
    capturedAt: new Date().toISOString(),
    monitorId: "primary",
    activeWindowTitle: "Liiketoimintasuunnitelma - oppimistehtävä",
    visibleText: "Laadi liiketoimintasuunnitelma yritykselle ja kuvaa osaamistavoitteet."
  });

  assert.ok(suggestion);
  assert.equal(suggestion.kind, "school");
  assert.equal(suggestion.action, "Tee suunnitelma");
  assert.ok(suggestion.confidence > 0.5);
});

test("ScreenContextAssistant stays silent on unrelated screen content", () => {
  const assistant = new ScreenContextAssistant();
  const suggestion = assistant.analyse({
    capturedAt: new Date().toISOString(),
    monitorId: "primary",
    activeWindowTitle: "Calculator",
    visibleText: "12345 + 67890"
  });

  assert.equal(suggestion, undefined);
});
