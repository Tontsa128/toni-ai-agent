import assert from "node:assert/strict";
import test from "node:test";
import { ComputerActionResultValidator } from "../agent/computer/ComputerActionResultValidator.js";
import type { ScreenObservation } from "../agent/vision/ScreenObservation.js";

const validator = new ComputerActionResultValidator();

const safeObservation: ScreenObservation = {
  capturedAt: new Date().toISOString(),
  monitorId: "primary",
  activeWindowTitle: "VS Code — toni-ai-agent",
  activeApplication: "Code",
  visibleText: "Build succeeded"
};

test("post-condition confirms matching window and OCR text", () => {
  const result = validator.validatePostCondition(safeObservation, {
    activeApplicationIncludes: "code",
    visibleTextIncludes: ["build succeeded"]
  });
  assert.equal(result.status, "confirmed");
});

test("post-condition reports a failed observable check", () => {
  const result = validator.validatePostCondition(safeObservation, {
    visibleTextIncludes: ["build failed"]
  });
  assert.equal(result.status, "not_confirmed");
});

test("post-condition is inconclusive without OCR text when text is required", () => {
  const { visibleText: _visibleText, ...withoutVisibleText } = safeObservation;
  const result = validator.validatePostCondition(withoutVisibleText, { visibleTextIncludes: ["build succeeded"] });
  assert.equal(result.status, "inconclusive");
});

test("post-condition refuses raw screen observations", () => {
  const result = validator.validatePostCondition(
    { ...safeObservation, imageDataUrl: "data:image/png;base64,AAAA" },
    { activeWindowTitleIncludes: "VS Code" }
  );
  assert.equal(result.status, "inconclusive");
});

test("empty expectations never count as confirmation", () => {
  const result = validator.validatePostCondition(safeObservation, {});
  assert.equal(result.status, "inconclusive");
});

test("post-condition can require text to be absent", () => {
  const result = validator.validatePostCondition(safeObservation, {
    visibleTextExcludes: ["Build failed", "Permission denied"]
  });
  assert.equal(result.status, "confirmed");
});

test("forbidden text prevents confirmation", () => {
  const result = validator.validatePostCondition(
    { ...safeObservation, visibleText: "Build succeeded — Permission denied" },
    { visibleTextIncludes: ["Build succeeded"], visibleTextExcludes: ["Permission denied"] }
  );
  assert.equal(result.status, "not_confirmed");
});
