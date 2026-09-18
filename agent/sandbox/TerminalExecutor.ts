import path from "node:path";
import type { ExecutionRequest, ExecutionResult, SandboxPolicy } from "./types.js";
import { ExecutionSandbox } from "./ExecutionSandbox.js";
import { WorkerClient } from "../worker/WorkerClient.js";
import { DEFAULT_WORKER_LIMITS, type WorkerLimits } from "../worker/WorkerLimits.js";
import { WindowsJobController, type WindowsJobOptions } from "../worker/WindowsJobController.js";

export interface TerminalExecutorOptions {
  policy: SandboxPolicy;
  executableAliases?: Record<string, string>;
  workerLimits?: WorkerLimits;
  windowsJob?: WindowsJobOptions;
}

/** Executes preflight-approved commands outside the main process through a bounded worker. */
export class TerminalExecutor {
  private readonly sandbox: ExecutionSandbox;
  private readonly aliases: Record<string,string>;
  private readonly workerClient: WorkerClient;

  constructor(private readonly options: TerminalExecutorOptions) {
    this.sandbox=new ExecutionSandbox(options.policy);
    this.aliases=options.executableAliases??{};
    const limits = options.workerLimits ?? DEFAULT_WORKER_LIMITS;
    const windowsJob = options.windowsJob && process.platform === "win32" ? new WindowsJobController(options.windowsJob) : undefined;
    this.workerClient=new WorkerClient({
      limits: {
        ...limits,
      timeoutMs: Math.min(DEFAULT_WORKER_LIMITS.timeoutMs, options.policy.maxExecutionMs),
      maxOutputBytes: options.policy.maxOutputBytes,
        maxErrorBytes: Math.min(limits.maxErrorBytes, options.policy.maxOutputBytes)
      },
      windowsJob
    });
  }

  async run(request: ExecutionRequest): Promise<ExecutionResult> {
    const parsed=this.parseCommand(request.command);
    if(!parsed) return this.blocked("Command could not be parsed safely");
    const rawExecutable=parsed[0]; if(!rawExecutable) return this.blocked("Executable is missing");
    const args=parsed.slice(1);
    const executable=this.normalizeExecutable(rawExecutable);
    const normalizedCommand=[executable,...args].map(quoteForPreflight).join(" ");
    const cwd=path.resolve(request.cwd);
    const preflight=this.sandbox.preflight({...request,command:normalizedCommand,cwd});
    if(!preflight.ok) return preflight;
    const started=Date.now();
    try {
      const response=await this.workerClient.run({command:executable,args,cwd}, request.signal ?? new AbortController().signal);
      return {
        ok:response.ok, exitCode:response.exitCode??null, stdout:response.stdout??"",
        stderr:response.stderr??"", durationMs:Date.now()-started, blocked:false,
        reason:response.error
      };
    } catch(error:unknown) {
      return {ok:false,exitCode:null,stdout:"",stderr:error instanceof Error?error.message:String(error),
        durationMs:Date.now()-started,blocked:false,reason:error instanceof Error?error.message:String(error)};
    }
  }

  private parseCommand(command:string):string[]|undefined {
    const input=command.trim(); if(!input||input.length>4096)return undefined;
    const args:string[]=[]; let current="",quote:"'"|'"'|undefined,escaping=false,tokenStarted=false;
    for(const char of input){
      if(escaping){current+=char;escaping=false;tokenStarted=true;continue;}
      if(char==="\\"&&quote!=="'"){escaping=true;tokenStarted=true;continue;}
      if(quote){if(char===quote)quote=undefined;else current+=char;tokenStarted=true;continue;}
      if(char==="'"||char==='"'){quote=char;tokenStarted=true;}
      else if(/\s/.test(char)){if(tokenStarted){args.push(current);current="";tokenStarted=false;}}
      else{current+=char;tokenStarted=true;}
    }
    if(escaping||quote||tokenStarted)args.push(current);
    if(quote||args.length===0||args.length>64||args.some(a=>a.length>4096))return undefined;
    return args;
  }
  private normalizeExecutable(executable:string):string {
    const alias=this.aliases[executable.toLowerCase()]??executable;
    if(process.platform==="win32"){const lower=alias.toLowerCase();if(["npm","npx","pnpm","yarn"].includes(lower)&&!lower.endsWith(".cmd"))return `${alias}.cmd`;}
    return alias;
  }
  private blocked(reason:string):ExecutionResult{return {ok:false,exitCode:null,stdout:"",stderr:"",durationMs:0,blocked:true,reason};}
}
function quoteForPreflight(value:string):string{return /\s/.test(value)?JSON.stringify(value):value;}
