import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ScreenCaptureProvider } from "./ScreenMonitor.js";
import type { ScreenObservation } from "./ScreenObservation.js";

const execFileAsync = promisify(execFile);

/**
 * Windows capture adapter. The monitor gate is the only supported caller in
 * the normal agent flow; this provider itself never enables monitoring.
 */
export class WindowsScreenCapture implements ScreenCaptureProvider {
  async capture(): Promise<ScreenObservation> {
    if (process.platform !== "win32") throw new Error("Windows screen capture is only available on Windows");
    const script = [
      "$ErrorActionPreference='Stop'",
      "Add-Type -AssemblyName System.Drawing",
      "Add-Type -AssemblyName System.Windows.Forms",
      "$b=[System.Windows.Forms.SystemInformation]::VirtualScreen",
      "$bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height",
      "$g=[System.Drawing.Graphics]::FromImage($bmp)",
      "$g.CopyFromScreen($b.Left,$b.Top,0,0,$bmp.Size)",
      "$p=[System.IO.Path]::GetTempFileName() + '.png'",
      "try { $bmp.Save($p,[System.Drawing.Imaging.ImageFormat]::Png); [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($p)) } finally { $g.Dispose(); $bmp.Dispose(); if(Test-Path -LiteralPath $p){Remove-Item -LiteralPath $p -Force -ErrorAction SilentlyContinue} }"
    ].join(";");
    const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
      windowsHide: true,
      maxBuffer: 25 * 1024 * 1024,
      timeout: 10000
    });
    const base64 = stdout.trim();
    if (!base64) throw new Error("Windows screen capture returned no image");
    return {
      capturedAt: new Date().toISOString(),
      monitorId: "virtual-screen",
      imageDataUrl: `data:image/png;base64,${base64}`
    };
  }
}
