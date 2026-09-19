import test from "node:test";
import assert from "node:assert/strict";
import { RequestRateLimiter } from "../../app/security/RequestRateLimiter.js";

test("rate limiter blocks requests after the configured window quota", () => {
  const limiter = new RequestRateLimiter(60_000);
  assert.equal(limiter.consume("client", 2, 1_000).allowed, true);
  assert.equal(limiter.consume("client", 2, 2_000).allowed, true);
  const blocked = limiter.consume("client", 2, 3_000);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterMs > 0);
});

test("rate limiter allows a request after the oldest entry expires", () => {
  const limiter = new RequestRateLimiter(60_000);
  limiter.consume("client", 1, 1_000);
  assert.equal(limiter.consume("client", 1, 61_001).allowed, true);
});
