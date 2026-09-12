import test from "node:test";
import assert from "node:assert/strict";
import { InteractiveSession, parseSessionInput } from "../app/InteractiveSession.js";

test("interactive command parser handles built-in commands", () => {
  assert.deepEqual(parseSessionInput("/help"), { type: "help" });
  assert.deepEqual(parseSessionInput("/reset"), { type: "reset" });
  assert.deepEqual(parseSessionInput("/status"), { type: "status" });
  assert.deepEqual(parseSessionInput("/approvals"), { type: "approvals" });
  assert.deepEqual(parseSessionInput("/approve abc"), { type: "approve", actionId: "abc" });
  assert.deepEqual(parseSessionInput("/reject abc"), { type: "reject", actionId: "abc" });
  assert.deepEqual(parseSessionInput("/model gpt-5.6-luna"), { type: "model", value: "gpt-5.6-luna" });
  assert.deepEqual(parseSessionInput("/quit"), { type: "exit" });
  assert.deepEqual(parseSessionInput("Tarkista README"), { type: "request", value: "Tarkista README" });
  assert.deepEqual(parseSessionInput("   "), { type: "empty" });
});

test("interactive session changes model and resets conversation state without an API key", () => {
  const session = new InteractiveSession({ workspace: "C:/toni-ai-agent", model: "test-model" });

  assert.equal(session.getState().model, "test-model");
  assert.equal(session.executeCommand({ type: "model", value: "another-model" })?.text, "Malli vaihdettu: another-model");
  assert.equal(session.getState().model, "another-model");

  const reply = session.executeCommand({ type: "status" });
  assert.match(reply?.text ?? "", /Keskustelutila: tyhjä/);

  assert.equal(session.executeCommand({ type: "reset" })?.text, "Keskustelutila nollattu.");
  assert.equal(session.getState().requestCount, 0);
});
