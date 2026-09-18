import { randomUUID } from "node:crypto";
import { fork, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { WorkerRequest, WorkerResponse } from "./WorkerProtocol.js";
import type { WorkerLimits } from "./WorkerLimits.js";
import { validateWorkerLimits } from "./WorkerLimits.js";
import { WindowsJobController } from "./WindowsJobController.js";

export interface WorkerCommand { command: string; args: string[]; cwd: string; }
export interface WorkerClientOptions {
  limits: WorkerLimits;
  windowsJob?: import("./WindowsJobController.js").WindowsJobOptions;
}

export class WorkerClient {
  private readonly workerPath: string;
  public constructor(private readonly options: WorkerClientOptions) {
    validateWorkerLimits(options.limits);
    this.workerPath = join(dirname(fileURLToPath(import.meta.url)), "WorkerProcess.js");
  }

  public run(command: WorkerCommand, signal: AbortSignal): Promise<WorkerResponse> {
    const requestId = randomUUID();
    const limits = this.options.limits;
    const jobOptions = this.options.windowsJob;
    return new Promise((resolve, reject) => {
      let child: ChildProcess | undefined;
      let settled = false;
      let timer: NodeJS.Timeout | undefined;
      const job = jobOptions ? new WindowsJobController(jobOptions) : undefined;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
        if (job) void job.terminate().catch(() => {});
      };
      const finishResolve = (response: WorkerResponse) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(response);
      };
      const finishReject = (error: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };
      const onAbort = () => {
        try { child?.kill(); } catch {}
        finishReject(new Error("Worker operation was cancelled."));
      };

      if (signal.aborted) { reject(new Error("Worker operation was cancelled.")); return; }

      const start = async () => {
        if (job) await job.validate();
        child = fork(this.workerPath, [], { stdio: ["ignore", "pipe", "pipe", "ipc"], windowsHide: true });
        if (!child.pid) throw new Error("Worker process did not expose a PID.");
        if (job) {
          await job.attach(child.pid);
          void job.waitForHelperExit().then(code => {
            if (!settled && code !== 0) {
              try { child?.kill(); } catch {}
              finishReject(new Error("Windows Job Object helper exited unexpectedly."));
            }
          });
        }

        let stdout = "";
        let stderr = "";
        child.stdout?.on("data", (c: Buffer) => { stdout = appendBounded(stdout, c.toString("utf8"), limits.maxOutputBytes); });
        child.stderr?.on("data", (c: Buffer) => { stderr = appendBounded(stderr, c.toString("utf8"), limits.maxErrorBytes); });
        child.once("message", message => {
          const response = message as WorkerResponse;
          finishResolve({ ...response, stdout: response.stdout ?? stdout, stderr: response.stderr ?? stderr });
          try { child?.kill(); } catch {}
        });
        child.once("error", error => finishReject(error));
        child.once("exit", () => { if (!settled) finishReject(new Error("Worker exited without a response.")); });
        timer = setTimeout(() => {
          try { child?.kill(); } catch {}
          finishReject(new Error("Worker operation timed out."));
        }, limits.timeoutMs);
        signal.addEventListener("abort", onAbort, { once: true });

        const request: WorkerRequest = {
          requestId,
          command: command.command,
          args: command.args,
          cwd: command.cwd,
          timeoutMs: limits.timeoutMs,
          maxOutputBytes: limits.maxOutputBytes,
          maxErrorBytes: limits.maxErrorBytes
        };
        child.send(request);
      };

      void start().catch(error => {
        try { child?.kill(); } catch {}
        finishReject(error instanceof Error ? error : new Error(String(error)));
      });
    });
  }
}

function appendBounded(current: string, addition: string, maximumBytes: number): string {
  const combined = current + addition;
  if (Buffer.byteLength(combined, "utf8") <= maximumBytes) return combined;
  return Buffer.from(combined, "utf8").subarray(0, maximumBytes).toString("utf8");
}