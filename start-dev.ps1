# Kiosk Digital Signage - Development Launcher
# Starts both backend and frontend in development mode

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Kiosk Digital Signage - Dev Mode" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get the script directory (project root)
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

# Check if node_modules exists
if (-not (Test-Path "$projectRoot/node_modules")) {
    Write-Host "Dependencies not installed. Running npm install..." -ForegroundColor Yellow
    npm install --legacy-peer-deps
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
}

Write-Host "Starting Backend..." -ForegroundColor Green
Write-Host "  Location: http://localhost:3000" -ForegroundColor Gray
Write-Host ""

Write-Host "Starting Frontend..." -ForegroundColor Green
Write-Host "  Location: http://localhost:5173" -ForegroundColor Gray
Write-Host ""

Write-Host "Press Ctrl+C to stop both services" -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Start backend in a new PowerShell window
$backendJob = Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$projectRoot\backend'; Write-Host 'Backend Server' -ForegroundColor Green; npm run start:dev"
) -PassThru

# Start frontend in a new PowerShell window
$frontendJob = Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$projectRoot\frontend'; Write-Host 'Frontend Dev Server' -ForegroundColor Blue; npm run dev"
) -PassThru

# Wait for user to press Ctrl+C
try {
    Write-Host "Services running. Press Ctrl+C to stop..." -ForegroundColor Cyan
    while ($true) {
        Start-Sleep -Seconds 1

        # Check if either process has exited
        if ($backendJob.HasExited) {
            Write-Host "Backend process has exited" -ForegroundColor Red
            break
        }
        if ($frontendJob.HasExited) {
            Write-Host "Frontend process has exited" -ForegroundColor Red
            break
        }
    }
}
finally {
    Write-Host ""
    Write-Host "Stopping services..." -ForegroundColor Yellow

    # Kill the processes
    if (-not $backendJob.HasExited) {
        Stop-Process -Id $backendJob.Id -Force -ErrorAction SilentlyContinue
        Write-Host "  Backend stopped" -ForegroundColor Green
    }

    if (-not $frontendJob.HasExited) {
        Stop-Process -Id $frontendJob.Id -Force -ErrorAction SilentlyContinue
        Write-Host "  Frontend stopped" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "All services stopped" -ForegroundColor Green
}
