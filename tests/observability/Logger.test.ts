import test from "node:test";
import assert from "node:assert/strict";
import { redactSecrets } from "../../agent/audit/Redactor.js";
test("redacts common secrets", () => {
  const value = redactSecrets("token=secret-value OPENAI_API_KEY=abc123");
  assert.equal(value.includes("secret-value"), false);
  assert.equal(value.includes("abc123"), false);
});
