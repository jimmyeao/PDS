# Stop any existing backend processes
Write-Host "Stopping any existing backend processes..." -ForegroundColor Yellow

# Kill processes on port 3000
$processesOnPort3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($processesOnPort3000) {
    foreach ($processId in $processesOnPort3000) {
        Write-Host "Killing process $processId on port 3000..." -ForegroundColor Yellow
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
}

# Start the backend
Write-Host "Starting backend..." -ForegroundColor Green
Set-Location "$PSScriptRoot\backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run start:dev"

Write-Host "Backend started!" -ForegroundColor Green
Write-Host "Backend running at http://localhost:3000" -ForegroundColor Cyan
