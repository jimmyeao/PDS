<#
.SYNOPSIS
    Intune detection script for Kiosk Client.

.DESCRIPTION
    Checks if Kiosk Client is installed and the service is present.
    Returns exit code 0 if detected, 1 if not detected.
#>

$InstallPath = "C:\Program Files\Kiosk Client"
$ServiceName = "KioskClient"
$AppFile = "$InstallPath\app\dist\index.js"

# Check if installation directory exists
if (-not (Test-Path $InstallPath)) {
    Write-Host "Installation directory not found"
    exit 1
}

# Check if app file exists
if (-not (Test-Path $AppFile)) {
    Write-Host "Application file not found"
    exit 1
}

# Check if service exists
$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $service) {
    Write-Host "Service not found"
    exit 1
}

# All checks passed
Write-Host "Kiosk Client detected"
exit 0
