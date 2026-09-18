import test from "node:test";
import assert from "node:assert/strict";
import { validateWorkerLimits, DEFAULT_WORKER_LIMITS } from "../../agent/worker/WorkerLimits.js";
test("rejects invalid worker timeout",()=>assert.throws(()=>validateWorkerLimits({...DEFAULT_WORKER_LIMITS,timeoutMs:10})));
test("accepts default worker limits",()=>assert.doesNotThrow(()=>validateWorkerLimits(DEFAULT_WORKER_LIMITS)));