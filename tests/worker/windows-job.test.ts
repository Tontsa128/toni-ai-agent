import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { WindowsJobController } from "../../agent/worker/WindowsJobController.js";

test("Windows Job Object kills the attached worker process", async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows Job Object is only available on Windows.");
    return;
  }
  const helperPath = process.env.TONI_JOB_HELPER_PATH;
  if (!helperPath) {
    t.skip("TONI_JOB_HELPER_PATH is not configured.");
    return;
  }
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { windowsHide: true });
  assert.ok(child.pid);
  const controller = new WindowsJobController({
    helperPath,
    memoryMb: 512,
    maxProcesses: 16,
    cpuTimeMs: 30_000,
    trustedRoot: process.env.TONI_TRUSTED_INSTALL_ROOT ?? process.cwd()
  });
  await controller.validate();
  await controller.attach(child.pid);
  assert.equal(controller.isAttached(), true);
  await controller.terminate();
  await new Promise<void>((resolve) => child.once("exit", () => resolve()));
  assert.equal(controller.isAttached(), false);
});