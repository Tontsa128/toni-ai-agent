$ErrorActionPreference = "Stop"

Write-Host "Toni AI Agent - Windows bootstrap"

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  throw "Node.js 22+ is required. Install Node.js LTS first, then run this script again."
}

$version = node --version
if ($version -notmatch '^v(2[2-9]|[3-9][0-9])\.') {
  throw "Node.js 22+ is required. Detected $version"
}

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env from .env.example. Fill secrets locally; never commit .env."
}

npm install
npx playwright install chromium
npm run check
npm run build
npm test

Write-Host "Bootstrap verification completed. Configure .env before starting the agent."
