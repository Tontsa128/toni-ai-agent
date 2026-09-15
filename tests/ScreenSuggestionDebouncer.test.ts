import assert from "node:assert/strict";
import test from "node:test";
import { ScreenSuggestionDebouncer } from "../agent/vision/ScreenSuggestionDebouncer.js";

const suggestion = {
  kind: "school" as const,
  title: "Koulutehtävä",
  message: "Tehdäänkö suunnitelma?",
  action: "Tee suunnitelma",
  confidence: 0.9
};

test("ScreenSuggestionDebouncer suppresses repeated suggestions during cooldown", () => {
  const debouncer = new ScreenSuggestionDebouncer(60_000);
  assert.equal(debouncer.shouldShow(suggestion, "business-plan"), true);
  assert.equal(debouncer.shouldShow(suggestion, "business-plan"), false);
  assert.equal(debouncer.shouldShow(suggestion, "different-page"), true);
});

test("ScreenSuggestionDebouncer can be reset", () => {
  const debouncer = new ScreenSuggestionDebouncer(60_000);
  debouncer.shouldShow(suggestion, "business-plan");
  debouncer.reset();
  assert.equal(debouncer.shouldShow(suggestion, "business-plan"), true);
});
