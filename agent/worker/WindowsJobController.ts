import { access, constants, realpath } from "node:fs/promises";
import { spawn, type ChildProcess } from "node:child_process";
import { isAbsolute, sep } from "node:path";

export interface WindowsJobOptions {
  helperPath: string;
  memoryMb: number;
  maxProcesses: number;
  cpuTimeMs: number;
  trustedRoot: string;
}

export class WindowsJobController {
  private helper?: ChildProcess;
  private helperExit?: Promise<number | null>;

  public constructor(private readonly options: WindowsJobOptions) {}

  public async validate(): Promise<void> {
    if (process.platform !== "win32") throw new Error("WindowsJobController requires Windows.");
    if (!isAbsolute(this.options.helperPath) || !this.options.helperPath.toLowerCase().endsWith(".exe")) {
      throw new Error("Windows job helper path must be an absolute .exe path.");
    }
    const [helperReal, rootReal] = await Promise.all([realpath(this.options.helperPath), realpath(this.options.trustedRoot)]);
    const rootPrefix = rootReal.endsWith(sep) ? rootReal : rootReal + sep;
    if (!helperReal.toLowerCase().startsWith(rootPrefix.toLowerCase())) {
      throw new Error("Windows job helper is outside the trusted installation directory.");
    }
    await access(helperReal, constants.F_OK | constants.X_OK);
  }

  public async attach(childPid: number): Promise<void> {
    if (process.platform !== "win32") throw new Error("WindowsJobController requires Windows.");
    if (this.helper) throw new Error("Windows job helper is already attached.");
    const helper = spawn(this.options.helperPath, [
      String(childPid),
      String(this.options.memoryMb * 1024 * 1024),
      String(this.options.maxProcesses),
      String(this.options.cpuTimeMs)
    ], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"], shell: false });
    this.helper = helper;
    let stderr = "";
    this.helperExit = new Promise<number | null>((resolve, reject) => {
      helper.stderr?.on("data", (chunk: Buffer) => { stderr = (stderr + chunk.toString("utf8")).slice(-4096); });
      helper.once("error", reject);
      helper.once("exit", resolve);
    });
    await new Promise<void>((resolve, reject) => {
      let output = "";
      const onData = (chunk: Buffer) => {
        output = (output + chunk.toString("utf8")).slice(-4096);
        if (output.includes("assigned")) {
          helper.stdout?.off("data", onData);
          resolve();
        }
      };
      helper.stdout?.on("data", onData);
      helper.once("error", reject);
      helper.once("exit", code => reject(new Error("Windows job helper exited before assignment (code " + code + "). " + stderr)));
    });
  }

  public async waitForHelperExit(): Promise<number | null> { return this.helperExit ? this.helperExit : null; }

  public async terminate(): Promise<void> {
    const helper = this.helper;
    if (!helper) return;
    try { helper.stdin?.write("terminate\n"); } catch {}
    await new Promise<void>(resolve => {
      const timer = setTimeout(() => { try { helper.kill(); } catch {} resolve(); }, 2000);
      helper.once("exit", () => { clearTimeout(timer); resolve(); });
    });
    this.helper = undefined;
    this.helperExit = undefined;
  }

  public isAttached(): boolean { return this.helper !== undefined; }
}