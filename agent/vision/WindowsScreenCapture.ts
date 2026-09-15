import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ScreenCaptureProvider } from "./ScreenMonitor.js";
import type { ScreenObservation } from "./ScreenObservation.js";

const execFileAsync = promisify(execFile);

/**
 * Windows capture adapter. PowerShell is invoked without a shell command
 * string; the adapter only writes a temporary PNG and reads it back. OCR and
 * active-window metadata remain separate providers so sensitive data can be
 * excluded before leaving the machine.
 */
export class WindowsScreenCapture implements ScreenCaptureProvider {
  async capture(): Promise<ScreenObservation> {
    if (process.platform !== "win32") throw new Error("Windows screen capture is only available on Windows");
    const script = [
      "$ErrorActionPreference='Stop'",
      "Add-Type -AssemblyName System.Drawing",
      "Add-Type -AssemblyName System.Windows.Forms",
      "$b=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds",
      "$bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height",
      "$g=[System.Drawing.Graphics]::FromImage($bmp)",
      "$g.CopyFromScreen($b.Location,[System.Drawing.Point]::Empty,$b.Size)",
      "$p=[System.IO.Path]::GetTempFileName() + '.png'",
      "$bmp.Save($p,[System.Drawing.Imaging.ImageFormat]::Png)",
      "$g.Dispose();$bmp.Dispose()",
      "[Convert]::ToBase64String([System.IO.File]::ReadAllBytes($p))",
      "Remove-Item -LiteralPath $p -Force"
    ].join(";");
    const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], {
      windowsHide: true,
      maxBuffer: 25 * 1024 * 1024,
      timeout: 10000
    });
    const base64 = stdout.trim();
    if (!base64) throw new Error("Windows screen capture returned no image");
    return {
      capturedAt: new Date().toISOString(),
      monitorId: "primary",
      imageDataUrl: `data:image/png;base64,${base64}`
    };
  }
}
