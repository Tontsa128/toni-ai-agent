import { spawn } from "node:child_process";
import { buildWorkerEnvironment } from "./SafeWorkerEnvironment.js";
import type { WorkerRequest, WorkerResponse } from "./WorkerProtocol.js";
process.on("message",(message:WorkerRequest)=>{void execute(message);});
async function execute(request:WorkerRequest):Promise<void>{
  if(!request.requestId||!request.command||!Array.isArray(request.args)||!request.cwd){send({requestId:request.requestId??"unknown",ok:false,error:"Invalid worker request."});process.exit(1);}
  let stdout="",stderr="";
  const child=spawn(request.command,request.args,{cwd:request.cwd,env:buildWorkerEnvironment(),windowsHide:true,shell:false,stdio:["ignore","pipe","pipe"]});
  const timeout=setTimeout(()=>child.kill(),request.timeoutMs);
  child.stdout.on("data",(chunk:Buffer)=>{stdout=appendBounded(stdout,chunk.toString("utf8"),request.maxOutputBytes);});
  child.stderr.on("data",(chunk:Buffer)=>{stderr=appendBounded(stderr,chunk.toString("utf8"),request.maxErrorBytes);});
  child.once("error",(error)=>{clearTimeout(timeout);send({requestId:request.requestId,ok:false,stdout,stderr,error:error.message});process.exit(1);});
  child.once("close",(exitCode,signal)=>{clearTimeout(timeout);send({requestId:request.requestId,ok:exitCode===0,exitCode,signal,stdout,stderr,...(exitCode===0?{}:{error:"Command exited with a non-zero code."})});process.exit(exitCode===0?0:1);});
}
function send(response:WorkerResponse):void{if(typeof process.send==="function") process.send(response);}
function appendBounded(current:string,addition:string,maximumBytes:number):string{
  const combined=current+addition;if(Buffer.byteLength(combined,"utf8")<=maximumBytes)return combined;
  return Buffer.from(combined,"utf8").subarray(0,maximumBytes).toString("utf8");
}