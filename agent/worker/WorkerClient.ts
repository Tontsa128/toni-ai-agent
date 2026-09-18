import { randomUUID } from "node:crypto";
import { fork,type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname,join } from "node:path";
import type { WorkerRequest,WorkerResponse } from "./WorkerProtocol.js";
import type { WorkerLimits } from "./WorkerLimits.js";
export interface WorkerCommand { command:string; args:string[]; cwd:string; }
export class WorkerClient {
  private readonly workerPath:string;
  public constructor(private readonly limits:WorkerLimits){
    const directory=dirname(fileURLToPath(import.meta.url)); this.workerPath=join(directory,"WorkerProcess.js");
  }
  public run(command:WorkerCommand,signal:AbortSignal):Promise<WorkerResponse>{
    const requestId=randomUUID();
    return new Promise((resolve,reject)=>{
      let child:ChildProcess|undefined,settled=false,timer:NodeJS.Timeout|undefined;
      const finish=(cb:()=>void)=>{if(settled)return;settled=true;if(timer)clearTimeout(timer);signal.removeEventListener("abort",onAbort);cb();};
      const onAbort=()=>{child?.kill();finish(()=>reject(new Error("Worker operation was cancelled.")));};
      if(signal.aborted){reject(new Error("Worker operation was cancelled."));return;}
      try{child=fork(this.workerPath,[],{stdio:["ignore","pipe","pipe","ipc"],windowsHide:true});}
      catch(error){reject(error);return;}
      let stdout="",stderr="";
      child.stdout?.on("data",(c:Buffer)=>{stdout=appendBounded(stdout,c.toString("utf8"),this.limits.maxOutputBytes);});
      child.stderr?.on("data",(c:Buffer)=>{stderr=appendBounded(stderr,c.toString("utf8"),this.limits.maxErrorBytes);});
      child.once("message",(message)=>{const response=message as WorkerResponse;finish(()=>resolve({...response,stdout:response.stdout??stdout,stderr:response.stderr??stderr}));child?.kill();});
      child.once("error",error=>finish(()=>reject(error)));
      child.once("exit",()=>{if(!settled)finish(()=>reject(new Error("Worker exited without a response.")));});
      timer=setTimeout(()=>{child?.kill();finish(()=>reject(new Error("Worker operation timed out.")));},this.limits.timeoutMs);
      signal.addEventListener("abort",onAbort,{once:true});
      const request:WorkerRequest={requestId,command:command.command,args:command.args,cwd:command.cwd,timeoutMs:this.limits.timeoutMs,maxOutputBytes:this.limits.maxOutputBytes,maxErrorBytes:this.limits.maxErrorBytes};
      child.send(request);
    });
  }
}
function appendBounded(current:string,addition:string,maximumBytes:number):string{
  const combined=current+addition;if(Buffer.byteLength(combined,"utf8")<=maximumBytes)return combined;
  return Buffer.from(combined,"utf8").subarray(0,maximumBytes).toString("utf8");
}