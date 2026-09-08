import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ComputerAdapter } from "./ComputerAdapter.js";

const execFileAsync = promisify(execFile);

export interface WindowsComputerOptions {
  maxTextLength?: number;
  maxKeypressLength?: number;
}

/**
 * Windows desktop adapter. Mutating operations must be approved by the central
 * PermissionEngine/ToolchainSupervisor before this adapter is invoked.
 * No credential entry, clipboard access, process killing, UAC, MFA or CAPTCHA bypass.
 */
export class WindowsComputerAdapter implements ComputerAdapter {
  private readonly maxTextLength: number;
  private readonly maxKeypressLength: number;

  constructor(options: WindowsComputerOptions = {}) {
    this.maxTextLength = options.maxTextLength ?? 4000;
    this.maxKeypressLength = options.maxKeypressLength ?? 32;
  }

  private assertWindows(): void {
    if (process.platform !== "win32") throw new Error("WindowsComputerAdapter requires Windows");
  }

  private async powershell(script: string): Promise<string> {
    this.assertWindows();
    const { stdout } = await execFileAsync("powershell.exe", [
      "-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script
    ], { maxBuffer: 1024 * 1024 });
    return stdout.trim();
  }

  async screenshot(): Promise<string> {
    const path = await this.powershell(`
      Add-Type -AssemblyName System.Windows.Forms
      Add-Type -AssemblyName System.Drawing
      $b = [System.Windows.Forms.SystemInformation]::VirtualScreen
      $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      $g.CopyFromScreen($b.Left, $b.Top, 0, 0, $bmp.Size)
      $path = Join-Path ([System.IO.Path]::GetTempPath()) ("toni-agent-screen-" + [guid]::NewGuid().ToString("N") + ".png")
      $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
      $g.Dispose(); $bmp.Dispose(); Write-Output $path
    `);
    if (!path) throw new Error("Screenshot path was not produced");
    return path;
  }

  async click(x: number, y: number): Promise<void> {
    ComputerInputPolicy.assertCoordinate(x, y);
    await this.powershell(`
      Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public static class ToniMouse {
        [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
        [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extraInfo);
      }
"@
      [ToniMouse]::SetCursorPos(${Math.round(x)}, ${Math.round(y)}) | Out-Null
      [ToniMouse]::mouse_event(0x0002,0,0,0,[UIntPtr]::Zero)
      [ToniMouse]::mouse_event(0x0004,0,0,0,[UIntPtr]::Zero)
    `);
  }

  async type(text: string): Promise<void> {
    if (text.length > this.maxTextLength) throw new Error("Text input exceeds safety limit");
    if (/password|passwd|secret|api[_ -]?key|mfa|otp|verification code/i.test(text)) {
      throw new Error("Credential or authentication-code entry is blocked");
    }
    const encoded = Buffer.from(text, "utf8").toString("base64");
    await this.powershell(`
      Add-Type -AssemblyName System.Windows.Forms
      $text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'))
      [System.Windows.Forms.SendKeys]::SendWait($text)
    `);
  }

  async keypress(key: string): Promise<void> {
    if (!/^[A-Za-z0-9+^%~(){}\[\]\\]+$/.test(key) || key.length > this.maxKeypressLength) {
      throw new Error("Unsupported or oversized key sequence");
    }
    if (/^(ALT\+F4|WIN|LWIN|RWIN|CTRL\+ALT\+DEL)$/i.test(key)) {
      throw new Error("System-level key sequence is blocked");
    }
    const encoded = Buffer.from(key, "utf8").toString("base64");
    await this.powershell(`
      Add-Type -AssemblyName System.Windows.Forms
      $key = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'))
      [System.Windows.Forms.SendKeys]::SendWait($key)
    `);
  }
}

export class ComputerInputPolicy {
  static assertCoordinate(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > 100000 || y > 100000) {
      throw new Error("Invalid screen coordinate");
    }
  }
}
