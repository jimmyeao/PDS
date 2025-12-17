#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Uninstalls Kiosk Digital Signage Client.

.DESCRIPTION
    Stops and removes the Kiosk client Windows service and deletes all installation files.
#>

$ErrorActionPreference = "Stop"

$ServiceName = "KioskClient"
$InstallPath = "C:\Program Files\Kiosk Client"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Kiosk Client Uninstallation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Stop service
Write-Host "[1/3] Stopping service..." -ForegroundColor Yellow
$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($service) {
    if ($service.Status -eq 'Running') {
        Stop-Service -Name $ServiceName -Force
        Write-Host "  [OK] Service stopped" -ForegroundColor Green
    } else {
        Write-Host "  [INFO] Service already stopped" -ForegroundColor Gray
    }
} else {
    Write-Host "  [INFO] Service not found" -ForegroundColor Gray
}
Write-Host ""

# Step 2: Remove service
Write-Host "[2/3] Removing service..." -ForegroundColor Yellow
if (Test-Path "$InstallPath\nssm.exe") {
    & "$InstallPath\nssm.exe" remove $ServiceName confirm 2>&1 | Out-Null
    Write-Host "  [OK] Service removed" -ForegroundColor Green
} else {
    & sc.exe delete $ServiceName 2>&1 | Out-Null
    Write-Host "  [OK] Service removed (via sc.exe)" -ForegroundColor Green
}
Start-Sleep -Seconds 2
Write-Host ""

# Step 3: Delete files
Write-Host "[3/3] Removing installation files..." -ForegroundColor Yellow
if (Test-Path $InstallPath) {
    Remove-Item $InstallPath -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  [OK] Files removed: $InstallPath" -ForegroundColor Green
} else {
    Write-Host "  [INFO] Installation directory not found" -ForegroundColor Gray
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Uninstallation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

exit 0
