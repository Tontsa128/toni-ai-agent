import assert from "node:assert/strict";
import test from "node:test";
import { ScreenSuggestionController } from "../agent/vision/ScreenSuggestionController.js";

const suggestion = {
  kind: "school" as const,
  title: "Koulutehtävä",
  message: "Tehdäänkö suunnitelma?",
  action: "Tee suunnitelma",
  confidence: 0.9
};

test("suggestion controller accepts and dismisses suggestions without changing capture state", () => {
  const controller = new ScreenSuggestionController();
  assert.equal(controller.getState().decision, "idle");
  assert.equal(controller.publish(suggestion).suggestion?.action, "Tee suunnitelma");
  assert.equal(controller.accept().decision, "accepted");
  controller.publish(suggestion);
  assert.equal(controller.dismiss().decision, "dismissed");
});

test("suggestion controller clear removes the suggestion", () => {
  const controller = new ScreenSuggestionController();
  controller.publish(suggestion);
  controller.clear();
  assert.deepEqual(controller.getState(), { decision: "idle" });
});
