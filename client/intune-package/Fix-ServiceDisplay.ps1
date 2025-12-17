#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Fixes the KioskClient service to display the browser window on desktop.

.DESCRIPTION
    Reconfigures the existing KioskClient service to enable desktop interaction.
    Run this if the service is installed but the browser window is not visible.

.EXAMPLE
    .\Fix-ServiceDisplay.ps1
#>

$ErrorActionPreference = "Stop"

$ServiceName = "KioskClient"
$InstallPath = "C:\Program Files\Kiosk Client"
$NssmExe = "$InstallPath\nssm.exe"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Kiosk Service Display Fix" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if service exists
$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $service) {
    Write-Host "[ERROR] Service $ServiceName not found" -ForegroundColor Red
    Write-Host "Please install the service first using Install.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host "[1/3] Stopping service..." -ForegroundColor Yellow
Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "  [OK] Service stopped" -ForegroundColor Green
Write-Host ""

# Check if NSSM exists
if (-not (Test-Path $NssmExe)) {
    Write-Host "[ERROR] NSSM not found at $NssmExe" -ForegroundColor Red
    exit 1
}

Write-Host "[2/3] Configuring desktop interaction..." -ForegroundColor Yellow

# Set service to interactive
& $NssmExe set $ServiceName Type SERVICE_INTERACTIVE_PROCESS | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  [OK] Enabled SERVICE_INTERACTIVE_PROCESS" -ForegroundColor Green
} else {
    Write-Host "  [!] Failed to enable desktop interaction (exit code: $LASTEXITCODE)" -ForegroundColor Yellow
    Write-Host "  [!] This feature is deprecated in Windows 10/11" -ForegroundColor Yellow
}

# Alternative: Get current user credentials
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
Write-Host "  [INFO] Current user: $currentUser" -ForegroundColor Cyan
Write-Host ""

Write-Host "[3/3] Starting service..." -ForegroundColor Yellow
Start-Service -Name $ServiceName
Start-Sleep -Seconds 3

$service = Get-Service -Name $ServiceName
if ($service.Status -eq 'Running') {
    Write-Host "  [OK] Service started successfully" -ForegroundColor Green
} else {
    Write-Host "  [!] Service status: $($service.Status)" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Fix Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "IMPORTANT: SERVICE_INTERACTIVE_PROCESS is deprecated in Windows 10/11" -ForegroundColor Yellow
Write-Host "If the browser is still not visible, you have these options:" -ForegroundColor White
Write-Host ""
Write-Host "Option 1: Use Remote Control (Recommended)" -ForegroundColor Cyan
Write-Host "  - The browser is running, just not visible locally" -ForegroundColor White
Write-Host "  - Use the admin dashboard remote control feature" -ForegroundColor White
Write-Host "  - Perfect for headless/remote kiosks" -ForegroundColor White
Write-Host ""
Write-Host "Option 2: Run as Startup Program (Alternative)" -ForegroundColor Cyan
Write-Host "  - Remove the service: .\Uninstall.ps1" -ForegroundColor White
Write-Host "  - Create startup shortcut instead (see below)" -ForegroundColor White
Write-Host ""
Write-Host "To create a startup shortcut:" -ForegroundColor Yellow
Write-Host "  1. Create shortcut to: C:\Program Files\Kiosk Client\start-kiosk.bat" -ForegroundColor White
Write-Host "  2. Place in: %APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup" -ForegroundColor White
Write-Host ""

exit 0
