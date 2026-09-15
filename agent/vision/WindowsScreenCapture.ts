import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ScreenCaptureProvider } from "./ScreenMonitor.js";
import type { ScreenObservation } from "./ScreenObservation.js";

const execFileAsync = promisify(execFile);

interface WindowsScreenMetadata {
  activeWindowTitle?: string;
  activeApplication?: string;
}

/**
 * Windows capture adapter. The monitor gate is the only supported caller in
 * the normal agent flow; this provider itself never enables monitoring.
 *
 * Capture is deliberately performed in one PowerShell invocation so the
 * screenshot and foreground-window metadata describe the same observation.
 */
export class WindowsScreenCapture implements ScreenCaptureProvider {
  async capture(): Promise<ScreenObservation> {
    if (process.platform !== "win32") throw new Error("Windows screen capture is only available on Windows");

    const script = [
      "$ErrorActionPreference='Stop'",
      "Add-Type -AssemblyName System.Drawing",
      "Add-Type -AssemblyName System.Windows.Forms",
      "Add-Type @'",
      "using System; using System.Text; using System.Runtime.InteropServices;",
      "public static class ToniForeground { [DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow(); [DllImport(\"user32.dll\", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count); [DllImport(\"user32.dll\")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId); }",
      "'@",
      "$b=[System.Windows.Forms.SystemInformation]::VirtualScreen",
      "$bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height",
      "$g=[System.Drawing.Graphics]::FromImage($bmp)",
      "$hwnd=[ToniForeground]::GetForegroundWindow()",
      "$titleBuilder=New-Object System.Text.StringBuilder 1024",
      "[void][ToniForeground]::GetWindowText($hwnd,$titleBuilder,$titleBuilder.Capacity)",
      "$pid=[uint32]0; [void][ToniForeground]::GetWindowThreadProcessId($hwnd,[ref]$pid)",
      "$app=''",
      "if($pid -gt 0){ try { $app=(Get-Process -Id $pid -ErrorAction Stop).ProcessName } catch { $app='' } }",
      "$g.CopyFromScreen($b.Left,$b.Top,0,0,$bmp.Size)",
      "$p=[System.IO.Path]::GetTempFileName() + '.png'",
      "try { $bmp.Save($p,[System.Drawing.Imaging.ImageFormat]::Png); $img=[Convert]::ToBase64String([System.IO.File]::ReadAllBytes($p)); [PSCustomObject]@{image=$img; title=$titleBuilder.ToString(); app=$app} | ConvertTo-Json -Compress } finally { $g.Dispose(); $bmp.Dispose(); if(Test-Path -LiteralPath $p){Remove-Item -LiteralPath $p -Force -ErrorAction SilentlyContinue} }"
    ].join(";");

    const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
      windowsHide: true,
      maxBuffer: 25 * 1024 * 1024,
      timeout: 10000
    });

    const payload = JSON.parse(stdout.trim()) as { image?: string; title?: string; app?: string };
    if (!payload.image) throw new Error("Windows screen capture returned no image");

    const metadata: WindowsScreenMetadata = {
      ...(payload.title ? { activeWindowTitle: payload.title } : {}),
      ...(payload.app ? { activeApplication: payload.app } : {})
    };

    return {
      capturedAt: new Date().toISOString(),
      monitorId: "virtual-screen",
      imageDataUrl: `data:image/png;base64,${payload.image}`,
      ...metadata
    };
  }
}
