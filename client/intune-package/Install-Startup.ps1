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

Write-Host "[1/8] Creating installation directories..." -ForegroundColor Yellow
@($InstallPath, $AppPath, $NodePath, $LogPath) | ForEach-Object {
    if (-not (Test-Path $_)) {
        New-Item -ItemType Directory -Path $_ -Force | Out-Null
        Write-Host "  [OK] Created: $_" -ForegroundColor Green
    }
}
Write-Host ""

# Copy client files
Write-Host "[2/8] Copying client application files..." -ForegroundColor Yellow
$ClientSrcPath = Split-Path -Parent $ScriptPath

if (Test-Path "$ClientSrcPath\dist") {
    Copy-Item "$ClientSrcPath\dist" -Destination $AppPath -Recurse -Force
    Write-Host "  [OK] Copied dist/ files" -ForegroundColor Green
} else {
    throw "Client dist/ folder not found. Please run 'npm run build' first."
}

Copy-Item "$ClientSrcPath\package.json" -Destination $AppPath -Force
Write-Host "  [OK] Copied package.json" -ForegroundColor Green

$RootNodeModules = "$ClientSrcPath\..\node_modules"
if (Test-Path $RootNodeModules) {
    Write-Host "  [...] Copying node_modules (this may take a few minutes)..." -ForegroundColor Yellow
    Copy-Item $RootNodeModules -Destination $AppPath -Recurse -Force
    Write-Host "  [OK] Copied node_modules" -ForegroundColor Green
} else {
    throw "node_modules not found at $RootNodeModules"
}
Write-Host ""

# Install Node.js
Write-Host "[3/8] Installing Node.js runtime..." -ForegroundColor Yellow
$BundledNode = "$ScriptPath\nodejs"
if (Test-Path $BundledNode) {
    Write-Host "  [...] Copying bundled Node.js..." -ForegroundColor Yellow
    Copy-Item "$BundledNode\*" -Destination $NodePath -Recurse -Force
    Write-Host "  [OK] Node.js installed from bundle" -ForegroundColor Green
} else {
    Write-Host "  [...] Downloading Node.js v20.18.1 (~50MB)..." -ForegroundColor Yellow
    $NodeUrl = "https://nodejs.org/dist/v20.18.1/node-v20.18.1-win-x64.zip"
    $NodeZip = "$env:TEMP\nodejs.zip"

    Invoke-WebRequest -Uri $NodeUrl -OutFile $NodeZip -UseBasicParsing
    Expand-Archive -Path $NodeZip -DestinationPath $env:TEMP -Force

    $ExtractedPath = "$env:TEMP\node-v20.18.1-win-x64"
    Copy-Item "$ExtractedPath\*" -Destination $NodePath -Recurse -Force

    Remove-Item $NodeZip -Force -ErrorAction SilentlyContinue
    Remove-Item $ExtractedPath -Recurse -Force -ErrorAction SilentlyContinue

    Write-Host "  [OK] Node.js downloaded and installed" -ForegroundColor Green
}

$NodeExe = "$NodePath\node.exe"
if (-not (Test-Path $NodeExe)) {
    throw "Node.js installation failed - node.exe not found"
}
$NodeVersion = & $NodeExe --version
Write-Host "  [OK] Node.js version: $NodeVersion" -ForegroundColor Green
Write-Host ""

# Check for Chrome
Write-Host "[4/8] Checking for Chrome browser..." -ForegroundColor Yellow

$ChromePaths = @(
    "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "${env:LOCALAPPDATA}\Google\Chrome\Application\chrome.exe"
)

$ChromeFound = $false
$ChromeExe = ""
foreach ($path in $ChromePaths) {
    if (Test-Path $path) {
        Write-Host "  [OK] Found existing Chrome: $path" -ForegroundColor Green
        $ChromeExe = $path
        $ChromeFound = $true
        break
    }
}

if (-not $ChromeFound) {
    Write-Host "  [!] No Chrome found - Puppeteer will use bundled Chromium" -ForegroundColor Yellow
    Write-Host "  [INFO] Consider installing Google Chrome for better compatibility" -ForegroundColor Cyan
}
Write-Host ""

# Create .env configuration
Write-Host "[5/8] Creating configuration file..." -ForegroundColor Yellow

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
Write-Host "  [OK] Configuration saved to: $EnvFile" -ForegroundColor Green
Write-Host ""

# Create wrapper batch file
Write-Host "[6/8] Creating startup wrapper..." -ForegroundColor Yellow

$WrapperBat = "$InstallPath\start-kiosk.bat"
$WrapperContent = @"
@echo off
cd /d "$AppPath"
"$NodeExe" "$AppPath\dist\index.js"
"@
$WrapperContent | Out-File -FilePath $WrapperBat -Encoding ASCII
Write-Host "  [OK] Created wrapper: $WrapperBat" -ForegroundColor Green
Write-Host ""

# Create VBS wrapper (silent, no console window)
Write-Host "[7/8] Creating silent launcher..." -ForegroundColor Yellow
$VbsWrapper = "$InstallPath\start-kiosk-silent.vbs"
$VbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run """$WrapperBat""", 0, False
Set WshShell = Nothing
"@
$VbsContent | Out-File -FilePath $VbsWrapper -Encoding ASCII
Write-Host "  [OK] Created silent launcher: $VbsWrapper" -ForegroundColor Green
Write-Host ""

# Create startup shortcut
Write-Host "[8/8] Creating startup shortcut..." -ForegroundColor Yellow

$StartupFolder = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
$ShortcutPath = "$StartupFolder\Kiosk Client.lnk"

# Create shortcut using VBS wrapper (silent)
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = """$VbsWrapper"""
$Shortcut.WorkingDirectory = $AppPath
$Shortcut.WindowStyle = 1  # Normal window
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
