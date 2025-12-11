# Kiosk Digital Signage - Development Launcher (Single Window)
# Starts both backend and frontend in the same terminal with color-coded output

$ErrorActionPreference = "Continue"

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

Write-Host "Starting services..." -ForegroundColor Green
Write-Host "  Backend:  http://localhost:3000" -ForegroundColor Gray
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C to stop both services" -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Start backend as background job
$backendJob = Start-Job -ScriptBlock {
    param($root)
    Set-Location "$root\backend"
    npm run start:dev 2>&1
} -ArgumentList $projectRoot

# Start frontend as background job
$frontendJob = Start-Job -ScriptBlock {
    param($root)
    Set-Location "$root\frontend"
    npm run dev 2>&1
} -ArgumentList $projectRoot

# Function to format output with color
function Write-JobOutput {
    param($job, $prefix, $color)

    $output = Receive-Job -Job $job
    if ($output) {
        foreach ($line in $output) {
            Write-Host "[$prefix] " -ForegroundColor $color -NoNewline
            Write-Host $line
        }
    }
}

# Monitor both jobs and display their output
try {
    while ($true) {
        # Display backend output in green
        Write-JobOutput -job $backendJob -prefix "BACKEND " -color Green

        # Display frontend output in blue
        Write-JobOutput -job $frontendJob -prefix "FRONTEND" -color Blue

        # Check if jobs are still running
        if ($backendJob.State -eq "Failed" -or $backendJob.State -eq "Stopped") {
            Write-Host "Backend job has stopped" -ForegroundColor Red
            break
        }
        if ($frontendJob.State -eq "Failed" -or $frontendJob.State -eq "Stopped") {
            Write-Host "Frontend job has stopped" -ForegroundColor Red
            break
        }

        Start-Sleep -Milliseconds 500
    }
}
finally {
    Write-Host ""
    Write-Host "Stopping services..." -ForegroundColor Yellow

    # Stop jobs
    Stop-Job -Job $backendJob -ErrorAction SilentlyContinue
    Stop-Job -Job $frontendJob -ErrorAction SilentlyContinue

    # Remove jobs
    Remove-Job -Job $backendJob -Force -ErrorAction SilentlyContinue
    Remove-Job -Job $frontendJob -Force -ErrorAction SilentlyContinue

    Write-Host "  Backend stopped" -ForegroundColor Green
    Write-Host "  Frontend stopped" -ForegroundColor Green
    Write-Host ""
    Write-Host "All services stopped" -ForegroundColor Green
}
