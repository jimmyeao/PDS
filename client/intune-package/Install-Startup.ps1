#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Installs Kiosk Client as a startup program (alternative to Windows service).

.DESCRIPTION
    This is an alternative to Install.ps1 that installs the Kiosk client as a
    startup program instead of a Windows service. This ensures the browser window
    is visible on the desktop.

.PARAMETER ServerUrl
    Backend server URL (e.g., http://192.168.0.57:5001)

.PARAMETER DeviceToken
    Device authentication token from admin dashboard

.PARAMETER DisplayWidth
    Display width in pixels (default: 1920)

.PARAMETER DisplayHeight
    Display height in pixels (default: 1080)

.PARAMETER KioskMode
    Enable fullscreen kiosk mode (default: true)

.PARAMETER LogLevel
    Logging level: debug, info, warn, error (default: info)

.EXAMPLE
    .\Install-Startup.ps1 -ServerUrl "http://192.168.0.57:5001" -DeviceToken "76DsItqcz0aW0IyZF3Ic0g"
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$ServerUrl,

    [Parameter(Mandatory=$true)]
    [string]$DeviceToken,

    [int]$DisplayWidth = 1920,
    [int]$DisplayHeight = 1080,
    [bool]$KioskMode = $true,
    [string]$LogLevel = "info"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# Configuration
$InstallPath = "C:\Program Files\Kiosk Client"
$AppPath = "$InstallPath\app"
$NodePath = "$InstallPath\nodejs"
$LogPath = "$InstallPath\logs"
$ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Kiosk Client Installation (Startup)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Installing as startup program (visible browser window)" -ForegroundColor Green
Write-Host ""

# First, check if service version is installed and offer to remove it
$existingService = Get-Service -Name "KioskClient" -ErrorAction SilentlyContinue
if ($existingService) {
    Write-Host "[!] Found existing KioskClient service" -ForegroundColor Yellow
    $response = Read-Host "Remove service and install as startup program instead? (y/n)"
    if ($response -eq 'y' -or $response -eq 'Y') {
        Write-Host "  [...] Removing service..." -ForegroundColor Yellow
        Stop-Service -Name "KioskClient" -Force -ErrorAction SilentlyContinue
        & sc.exe delete KioskClient | Out-Null
        Write-Host "  [OK] Service removed" -ForegroundColor Green
    } else {
        Write-Host "  [!] Installation cancelled" -ForegroundColor Yellow
        exit 0
    }
}

# Run the main installation steps (reuse logic from Install.ps1)
# For brevity, this would include all the same steps 1-6 from Install.ps1
# (copying files, installing Node.js, checking Chrome, creating .env)

# NOTE: For now, assuming Install.ps1 was already run
# This script just converts service → startup

Write-Host "[1/3] Verifying installation..." -ForegroundColor Yellow
if (-not (Test-Path "$AppPath\dist\index.js")) {
    Write-Host "[ERROR] Kiosk client not found at $AppPath" -ForegroundColor Red
    Write-Host "Please run Install.ps1 first to install the client files" -ForegroundColor Yellow
    exit 1
}

$NodeExe = "$NodePath\node.exe"
if (-not (Test-Path $NodeExe)) {
    Write-Host "[ERROR] Node.js not found at $NodePath" -ForegroundColor Red
    Write-Host "Please run Install.ps1 first to install Node.js" -ForegroundColor Yellow
    exit 1
}
Write-Host "  [OK] Installation files found" -ForegroundColor Green
Write-Host ""

# Update .env configuration
Write-Host "[2/3] Updating configuration..." -ForegroundColor Yellow

# Detect Chrome
$ChromePaths = @(
    "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "${env:LOCALAPPDATA}\Google\Chrome\Application\chrome.exe"
)

$ChromeExe = ""
foreach ($path in $ChromePaths) {
    if (Test-Path $path) {
        $ChromeExe = $path
        break
    }
}

$EnvContent = @"
# Kiosk Client Configuration
# Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

SERVER_URL=$ServerUrl
DEVICE_TOKEN=$DeviceToken
DISPLAY_WIDTH=$DisplayWidth
DISPLAY_HEIGHT=$DisplayHeight
KIOSK_MODE=$($KioskMode.ToString().ToLower())
LOG_LEVEL=$LogLevel
PUPPETEER_EXECUTABLE_PATH=$ChromeExe
HEALTH_CHECK_INTERVAL=60000
SCREENSHOT_INTERVAL=300000
"@

$EnvFile = "$AppPath\.env"
$EnvContent | Out-File -FilePath $EnvFile -Encoding UTF8 -Force
Write-Host "  [OK] Configuration updated" -ForegroundColor Green
Write-Host ""

# Create startup shortcut
Write-Host "[3/3] Creating startup shortcut..." -ForegroundColor Yellow

$StartupFolder = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
$ShortcutPath = "$StartupFolder\Kiosk Client.lnk"
$WrapperBat = "$InstallPath\start-kiosk.bat"

# Create wrapper batch file if it doesn't exist
if (-not (Test-Path $WrapperBat)) {
    $WrapperContent = @"
@echo off
cd /d "$AppPath"
"$NodeExe" "$AppPath\dist\index.js"
"@
    $WrapperContent | Out-File -FilePath $WrapperBat -Encoding ASCII
}

# Create shortcut
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $WrapperBat
$Shortcut.WorkingDirectory = $AppPath
$Shortcut.WindowStyle = 7  # Minimized
$Shortcut.Description = "Kiosk Digital Signage Client"
$Shortcut.Save()

Write-Host "  [OK] Startup shortcut created: $ShortcutPath" -ForegroundColor Green
Write-Host ""

# Installation summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Installation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Installation Type:  Startup Program (visible browser)" -ForegroundColor White
Write-Host "Installation Path:  $InstallPath" -ForegroundColor White
Write-Host "Startup Shortcut:   $ShortcutPath" -ForegroundColor White
Write-Host "Configuration:      $EnvFile" -ForegroundColor White
Write-Host "Logs:               $LogPath" -ForegroundColor White
Write-Host ""
Write-Host "Connecting to:      $ServerUrl" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Log out and log back in (or restart) to start the client" -ForegroundColor White
Write-Host "  2. Browser window will appear automatically on login" -ForegroundColor White
Write-Host "  3. Verify in admin dashboard at $ServerUrl" -ForegroundColor White
Write-Host ""
Write-Host "To start now without logging out:" -ForegroundColor Yellow
Write-Host "  Start-Process '$WrapperBat'" -ForegroundColor White
Write-Host ""

exit 0
