# Stop all backend and frontend processes
Write-Host "Stopping all development servers..." -ForegroundColor Yellow

# Kill processes on port 3000 (backend)
Write-Host "Stopping backend (port 3000)..." -ForegroundColor Yellow
$processesOnPort3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($processesOnPort3000) {
    foreach ($processId in $processesOnPort3000) {
        Write-Host "  Killing process $processId" -ForegroundColor Gray
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "  No backend processes found" -ForegroundColor Gray
}

# Kill processes on port 5173 (frontend)
Write-Host "Stopping frontend (port 5173)..." -ForegroundColor Yellow
$processesOnPort5173 = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($processesOnPort5173) {
    foreach ($processId in $processesOnPort5173) {
        Write-Host "  Killing process $processId" -ForegroundColor Gray
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "  No frontend processes found" -ForegroundColor Gray
}

Write-Host "`nAll development servers stopped!" -ForegroundColor Green
