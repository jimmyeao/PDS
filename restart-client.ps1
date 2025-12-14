# Stop all Chrome processes (including Puppeteer browser)
Write-Host "Stopping Chrome processes..." -ForegroundColor Yellow
Get-Process chrome -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Remove browser profile lock
if (Test-Path "C:\tmp\kiosk-browser-profile") {
    Write-Host "Removing browser profile lock..." -ForegroundColor Yellow
    Remove-Item "C:\tmp\kiosk-browser-profile" -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Starting kiosk client..." -ForegroundColor Green
Set-Location "$PSScriptRoot\client"
npm start
