# Kiosk Digital Signage - Start All Services
# This script starts backend, frontend, and client

Write-Host "===========================================  " -ForegroundColor Cyan
Write-Host "  Kiosk Digital Signage - Starting All     " -ForegroundColor Cyan
Write-Host "=========================================== `n" -ForegroundColor Cyan

# 1. Start Backend
Write-Host "[1/3] Starting backend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\src\PDS.Api'; dotnet run" -WindowStyle Normal

Write-Host "Waiting for backend to start..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# 2. Start Frontend
Write-Host "`n[2/3] Starting frontend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev" -WindowStyle Normal

Write-Host "Waiting for frontend to start..." -ForegroundColor Gray
Start-Sleep -Seconds 3

# 3. Start Client
Write-Host "`n[3/3] Starting client..." -ForegroundColor Yellow

# Kill any existing Chrome processes and clean profile
Get-Process chrome -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
if (Test-Path "C:\tmp\kiosk-browser-profile") {
    Remove-Item "C:\tmp\kiosk-browser-profile" -Recurse -Force -ErrorAction SilentlyContinue
}

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\client'; npm start" -WindowStyle Normal

Write-Host "`n========================================== " -ForegroundColor Green
Write-Host "  All services started!                    " -ForegroundColor Green
Write-Host "=========================================== `n" -ForegroundColor Green

Write-Host "Backend:  http://localhost:5001" -ForegroundColor White
Write-Host "Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "Device:   dev-001 (running locally)`n" -ForegroundColor White

Write-Host "Login credentials:" -ForegroundColor Cyan
Write-Host "  Username: admin" -ForegroundColor White
Write-Host "  Password: admin123`n" -ForegroundColor White

Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
