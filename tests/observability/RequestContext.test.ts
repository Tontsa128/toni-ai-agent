import test from "node:test";
import assert from "node:assert/strict";
import { createRequestContext } from "../../app/observability/RequestContext.js";
test("request context creates a stable correlation ID", () => {
  const context = createRequestContext();
  assert.match(context.requestId, /^[0-9a-f-]{36}$/);
  assert.equal(context.requestId, createRequestContext({ requestId: context.requestId }).requestId);
});
