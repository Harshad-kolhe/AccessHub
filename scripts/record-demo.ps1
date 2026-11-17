# Records the AccessHub demo GIF and the README screenshots: starts the API and the production web app, runs the
# Playwright scripts, stops both. Use fresh demo data (an empty database the API seeds on start); see
# docs/DEMO_RECORDING.md.
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

Write-Host "Installing recorder dependencies..." -ForegroundColor Cyan
Push-Location scripts
npm install --silent
npx playwright install chromium
Pop-Location

Write-Host "Starting the API on http://localhost:5177 ..." -ForegroundColor Cyan
$api = Start-Process -FilePath "dotnet" -ArgumentList "run","--project","src/AccessHub.Api","--launch-profile","http" -PassThru -WindowStyle Hidden

Write-Host "Building the web app (standalone output)..." -ForegroundColor Cyan
Push-Location web
npm run build
Copy-Item -Recurse -Force .next\static .next\standalone\.next\static
Pop-Location

Write-Host "Starting the web app on http://localhost:3000 ..." -ForegroundColor Cyan
$env:PORT = "3000"; $env:HOSTNAME = "localhost"; $env:API_URL = "http://localhost:5177"; $env:PUBLIC_API_URL = "http://localhost:5177"
$web = Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory "$Root\web\.next\standalone" -PassThru -WindowStyle Hidden

try {
    Push-Location scripts
    npm run screenshots
    npm run record
    Pop-Location
    Write-Host "`nDone: docs/screenshots and docs/demo/accesshub-demo.gif" -ForegroundColor Green
}
finally {
    Write-Host "Stopping servers..." -ForegroundColor Cyan
    # /T stops the whole process tree: killing only the parent would leave node/dotnet holding the ports.
    foreach ($process in @($api, $web)) {
        if ($process -and -not $process.HasExited) { taskkill /PID $process.Id /T /F | Out-Null }
    }
}
