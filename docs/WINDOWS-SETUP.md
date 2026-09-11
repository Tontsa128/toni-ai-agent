# Windows setup

The supported development target is Windows with Node.js 20+.

## Bootstrap

From the repository root in PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\bootstrap-windows.ps1
```

The script:

1. verifies Node.js 20+;
2. creates `.env` from `.env.example` if missing;
3. installs npm dependencies;
4. installs the Playwright Chromium runtime;
5. runs type checking, build and tests.

The script does not request administrator privileges and does not configure UAC, Windows Defender, passwords, MFA or other security controls.

## Secrets

Set `OPENAI_API_KEY`, and only the integration secrets actually required. Generate a random 32-byte base64 key for `TONI_MEMORY_KEY`. Keep `.env` local.

For production Windows deployment, replace environment-file secrets with Windows Credential Manager/DPAPI or another managed secret store before unattended operation.
