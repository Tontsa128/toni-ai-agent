import test from "node:test";
import assert from "node:assert/strict";
import { WorkerClient } from "../../agent/worker/WorkerClient.js";
import { DEFAULT_WORKER_LIMITS } from "../../agent/worker/WorkerLimits.js";
test("worker cancellation rejects and terminates the worker",async()=>{
  const controller=new AbortController();
  const client=new WorkerClient({...DEFAULT_WORKER_LIMITS,timeoutMs:10000});
  const promise=client.run({command:process.execPath,args:["-e","setTimeout(()=>{},10000)"],cwd:process.cwd()},controller.signal);
  setTimeout(()=>controller.abort(),50);
  await assert.rejects(promise,/cancelled/i);
});