import assert from "node:assert/strict";
import test from "node:test";
import { ComputerActionResultValidator } from "../agent/computer/ComputerActionResultValidator.js";

const validator = new ComputerActionResultValidator();

test("validator accepts only explicitly approved successful executions", () => {
  const result = validator.validate({ ok: true, approved: true, output: { ok: true } });
  assert.equal(result.status, "accepted");
});

test("validator rejects unapproved executions", () => {
  const result = validator.validate({ ok: true, approved: false, output: { ok: true } });
  assert.equal(result.status, "failed");
});

test("validator rejects adapter failures", () => {
  const result = validator.validate({ ok: false, approved: true, output: { error: "failed" } });
  assert.equal(result.status, "failed");
});

test("validator rejects missing execution output", () => {
  const result = validator.validate({ ok: true, approved: true, output: undefined });
  assert.equal(result.status, "failed");
});
