# Start both backend and frontend development servers
Write-Host "Starting Kiosk Digital Signage - Development Environment" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# Stop any existing processes first
Write-Host "Stopping any existing processes..." -ForegroundColor Yellow
& "$PSScriptRoot\stop-all.ps1"
Write-Host ""

# Wait a moment for processes to fully stop
Start-Sleep -Seconds 2

# Start backend
Write-Host "Starting backend..." -ForegroundColor Green
Set-Location "$PSScriptRoot\backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'Backend Server' -ForegroundColor Cyan; Write-Host '===============' -ForegroundColor Cyan; npm run start:dev"

# Wait a moment before starting frontend
Start-Sleep -Seconds 3

# Start frontend
Write-Host "Starting frontend..." -ForegroundColor Green
Set-Location "$PSScriptRoot\frontend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'Frontend Server' -ForegroundColor Cyan; Write-Host '================' -ForegroundColor Cyan; npm run dev"

Write-Host ""
Write-Host "Development servers started!" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "Backend:  http://localhost:3000" -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Yellow
Write-Host "Docs:     http://localhost:3000/api/docs" -ForegroundColor Yellow
Write-Host ""
Write-Host "To stop all servers, run: .\stop-all.ps1" -ForegroundColor Gray
