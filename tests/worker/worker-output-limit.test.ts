import test from "node:test";
import assert from "node:assert/strict";
import { WorkerClient } from "../../agent/worker/WorkerClient.js";
import { DEFAULT_WORKER_LIMITS } from "../../agent/worker/WorkerLimits.js";
test("worker stdout is bounded",async()=>{
  const client=new WorkerClient({...DEFAULT_WORKER_LIMITS,timeoutMs:5000,maxOutputBytes:1024});
  const result=await client.run({command:process.execPath,args:["-e","process.stdout.write('x'.repeat(100000))"],cwd:process.cwd()},new AbortController().signal);
  if(!result.ok) throw new Error(result.error??"worker failed");
  if(Buffer.byteLength(result.stdout??"","utf8")>1024) throw new Error("stdout exceeded configured limit");
});