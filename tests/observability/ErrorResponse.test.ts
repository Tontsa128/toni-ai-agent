import test from "node:test";
import assert from "node:assert/strict";
import { AgentError } from "../../agent/errors/AgentError.js";
import { createErrorResponse } from "../../app/observability/ErrorResponse.js";
test("internal errors never expose internal details", () => {
  const result = createErrorResponse(new Error("OPENAI_API_KEY=super-secret"), "req-123");
  assert.equal(result.statusCode, 500);
  assert.equal(result.body.error, "Internal server error.");
  assert.equal(result.body.requestId, "req-123");
});
test("agent errors retain safe public classification", () => {
  const result = createErrorResponse(new AgentError("PERMISSION_DENIED", "Permission denied.", false), "req-456");
  assert.equal(result.statusCode, 403);
  assert.equal(result.body.code, "PERMISSION_DENIED");
});
