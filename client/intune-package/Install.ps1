#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Installs Kiosk Digital Signage Client as a Windows service.

.DESCRIPTION
    Deploys the Kiosk client to Program Files, installs Node.js runtime,
    creates configuration, and sets up a Windows service for automatic startup.

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
    .\Install.ps1 -ServerUrl "http://192.168.0.57:5001" -DeviceToken "76DsItqcz0aW0IyZF3Ic0g"
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
$ServiceName = "KioskClient"
$ServiceDisplayName = "Kiosk Digital Signage Client"
$ServiceDescription = "Manages digital signage display, playlist execution, and remote control"
$InstallPath = "C:\Program Files\Kiosk Client"
$AppPath = "$InstallPath\app"
$NodePath = "$InstallPath\nodejs"
$LogPath = "$InstallPath\logs"
$ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path

# NSSM Configuration
$NssmUrl = "https://github.com/kirillkovalenko/nssm/releases/download/2.24/nssm-2.24.zip"
$NssmExe = "$ScriptPath\nssm.exe"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Kiosk Client Installation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Validate parameters
Write-Host "[1/9] Validating parameters..." -ForegroundColor Yellow
if (-not ($ServerUrl -match '^https?://')) {
    throw "ServerUrl must start with http:// or https://"
}
if ([string]::IsNullOrWhiteSpace($DeviceToken)) {
    throw "DeviceToken cannot be empty"
}
Write-Host "  [OK] Server: $ServerUrl" -ForegroundColor Green
Write-Host "  [OK] Token: $($DeviceToken.Substring(0, [Math]::Min(10, $DeviceToken.Length)))..." -ForegroundColor Green
Write-Host ""

# Step 2: Stop existing service if running
Write-Host "[2/9] Checking for existing installation..." -ForegroundColor Yellow
$existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existingService) {
    Write-Host "  [!] Found existing service, stopping..." -ForegroundColor Yellow
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2

    # Try to remove service
    & sc.exe delete $ServiceName | Out-Null
    Start-Sleep -Seconds 1
    Write-Host "  [OK] Existing service removed" -ForegroundColor Green
}
Write-Host ""

# Step 3: Create installation directories
Write-Host "[3/9] Creating installation directories..." -ForegroundColor Yellow
@($InstallPath, $AppPath, $NodePath, $LogPath) | ForEach-Object {
    if (-not (Test-Path $_)) {
        New-Item -ItemType Directory -Path $_ -Force | Out-Null
        Write-Host "  [OK] Created: $_" -ForegroundColor Green
    }
}
Write-Host ""

# Step 4: Copy client files
Write-Host "[4/9] Copying client application files..." -ForegroundColor Yellow
$ClientSrcPath = Split-Path -Parent $ScriptPath

# Copy dist folder
if (Test-Path "$ClientSrcPath\dist") {
    Copy-Item "$ClientSrcPath\dist" -Destination $AppPath -Recurse -Force
    Write-Host "  [OK] Copied dist/ files" -ForegroundColor Green
} else {
    throw "Client dist/ folder not found. Please run 'npm run build' first."
}

# Copy package.json
Copy-Item "$ClientSrcPath\package.json" -Destination $AppPath -Force
Write-Host "  [OK] Copied package.json" -ForegroundColor Green

# Copy node_modules from root (monorepo)
$RootNodeModules = "$ClientSrcPath\..\node_modules"
if (Test-Path $RootNodeModules) {
    Write-Host "  [...] Copying node_modules (this may take a few minutes)..." -ForegroundColor Yellow
    Copy-Item $RootNodeModules -Destination $AppPath -Recurse -Force
    Write-Host "  [OK] Copied node_modules" -ForegroundColor Green
} else {
    throw "node_modules not found at $RootNodeModules"
}
Write-Host ""

# Step 5: Install Node.js
Write-Host "[5/9] Installing Node.js runtime..." -ForegroundColor Yellow
$BundledNode = "$ScriptPath\nodejs"
if (Test-Path $BundledNode) {
    # Use bundled Node.js
    Write-Host "  [...] Copying bundled Node.js..." -ForegroundColor Yellow
    Copy-Item "$BundledNode\*" -Destination $NodePath -Recurse -Force
    Write-Host "  [OK] Node.js installed from bundle" -ForegroundColor Green
} else {
    # Download Node.js
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

# Verify Node.js
$NodeExe = "$NodePath\node.exe"
if (-not (Test-Path $NodeExe)) {
    throw "Node.js installation failed - node.exe not found"
}
$NodeVersion = & $NodeExe --version
Write-Host "  [OK] Node.js version: $NodeVersion" -ForegroundColor Green
Write-Host ""

# Step 5.5: Check for Chrome/Install Puppeteer Chrome browser
Write-Host "[5.5/9] Checking for Chrome browser..." -ForegroundColor Yellow

# Check for existing Chrome installation
$ChromePaths = @(
    "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "${env:LOCALAPPDATA}\Google\Chrome\Application\chrome.exe"
)

$ChromeFound = $false
foreach ($path in $ChromePaths) {
    if (Test-Path $path) {
        Write-Host "  [OK] Found existing Chrome: $path" -ForegroundColor Green
        Write-Host "  [OK] Will use existing Chrome instead of downloading Chromium" -ForegroundColor Green
        $ChromeFound = $true
        break
    }
}

# Only install Puppeteer Chrome if no existing Chrome found
if (-not $ChromeFound) {
    Write-Host "  [!] No Chrome installation found, installing Puppeteer Chrome..." -ForegroundColor Yellow

    # Add Node.js to PATH for this session
    $env:PATH = "$NodePath;$env:PATH"

    # Verify npm exists
    $NpmCmd = "$NodePath\npm.cmd"
    if (-not (Test-Path $NpmCmd)) {
        Write-Host "  [!] WARNING: npm.cmd not found in Node.js installation" -ForegroundColor Yellow
        Write-Host "  [!] Cannot install Puppeteer Chrome - service may fail to start" -ForegroundColor Red
    } else {
        try {
            # Change to app directory
            Push-Location $AppPath

            # Install production dependencies (if needed)
            Write-Host "  [...] Verifying dependencies..." -ForegroundColor Yellow
            & $NpmCmd install --production --no-audit --no-fund 2>&1 | Out-Null

            if ($LASTEXITCODE -ne 0) {
                Write-Host "  [!] npm install completed with warnings (non-critical)" -ForegroundColor Yellow
            }

            # Install Puppeteer Chrome browser using npx
            Write-Host "  [...] Downloading Chromium browser (this may take several minutes)..." -ForegroundColor Yellow
            $NpxCmd = "$NodePath\npx.cmd"

            if (Test-Path $NpxCmd) {
                # Use puppeteer CLI to install chrome
                $npxOutput = & $NpxCmd puppeteer browsers install chrome 2>&1
                $npxOutput | ForEach-Object {
                    if ($_ -match "Downloaded to") {
                        Write-Host "  [OK] $_" -ForegroundColor Green
                    }
                }

                if ($LASTEXITCODE -eq 0) {
                    Write-Host "  [OK] Puppeteer Chrome installed successfully" -ForegroundColor Green
                } else {
                    Write-Host "  [!] ERROR: Puppeteer Chrome installation failed (exit code: $LASTEXITCODE)" -ForegroundColor Red
                    Write-Host "  [!] Service will fail to start without a browser" -ForegroundColor Red
                    Write-Host "  [!] Consider installing Google Chrome manually" -ForegroundColor Yellow
                }
            } else {
                Write-Host "  [!] ERROR: npx.cmd not found" -ForegroundColor Red
                Write-Host "  [!] Cannot install Puppeteer Chrome - service will fail" -ForegroundColor Red
            }

            Pop-Location
        } catch {
            Write-Host "  [!] ERROR during Puppeteer installation: $($_.Exception.Message)" -ForegroundColor Red
            Pop-Location
        }
    }
}
Write-Host ""

# Step 6: Create .env configuration
Write-Host "[6/9] Creating configuration file..." -ForegroundColor Yellow

# Try to detect existing Chrome installation
$ChromePaths = @(
    "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "${env:LOCALAPPDATA}\Google\Chrome\Application\chrome.exe"
)

$ChromeExe = $null
foreach ($path in $ChromePaths) {
    if (Test-Path $path) {
        $ChromeExe = $path
        Write-Host "  [OK] Found existing Chrome: $ChromeExe" -ForegroundColor Green
        break
    }
}

if (-not $ChromeExe) {
    Write-Host "  [!] No existing Chrome installation found" -ForegroundColor Yellow
    Write-Host "  [!] Puppeteer will try to use its bundled Chromium" -ForegroundColor Yellow
    $ChromeExe = ""
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
Write-Host "  [OK] Configuration saved to: $EnvFile" -ForegroundColor Green
Write-Host ""

# Step 7: Download/Setup NSSM
Write-Host "[7/9] Setting up service manager (NSSM)..." -ForegroundColor Yellow
if (-not (Test-Path $NssmExe)) {
    Write-Host "  [...] Downloading NSSM..." -ForegroundColor Yellow
    $NssmZip = "$env:TEMP\nssm.zip"
    Invoke-WebRequest -Uri $NssmUrl -OutFile $NssmZip -UseBasicParsing
    Expand-Archive -Path $NssmZip -DestinationPath $env:TEMP -Force

    # Copy correct architecture
    $NssmSource = "$env:TEMP\nssm-2.24\win64\nssm.exe"
    Copy-Item $NssmSource -Destination $NssmExe -Force

    Remove-Item $NssmZip -Force -ErrorAction SilentlyContinue
    Remove-Item "$env:TEMP\nssm-2.24" -Recurse -Force -ErrorAction SilentlyContinue

    Write-Host "  [OK] NSSM downloaded" -ForegroundColor Green
}

# Copy NSSM to install directory for future use
$InstalledNssm = "$InstallPath\nssm.exe"
Copy-Item $NssmExe -Destination $InstalledNssm -Force
Write-Host "  [OK] NSSM ready" -ForegroundColor Green
Write-Host ""

# Step 8: Install Windows service
Write-Host "[8/9] Installing Windows service..." -ForegroundColor Yellow
$ServiceScript = "$AppPath\dist\index.js"

# Create wrapper batch file to handle path quoting
$WrapperBat = @"
@echo off
cd /d "$AppPath"
"$NodeExe" "$ServiceScript"
"@
$WrapperPath = "$InstallPath\start-kiosk.bat"
$WrapperBat | Out-File -FilePath $WrapperPath -Encoding ASCII
Write-Host "  [OK] Created service wrapper" -ForegroundColor Green

# Install service using wrapper batch file (avoids NSSM quoting issues)
& $InstalledNssm install $ServiceName $WrapperPath 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Failed to install service"
}
& $InstalledNssm set $ServiceName DisplayName "$ServiceDisplayName" | Out-Null
& $InstalledNssm set $ServiceName Description "$ServiceDescription" | Out-Null
& $InstalledNssm set $ServiceName AppDirectory "$AppPath" | Out-Null
& $InstalledNssm set $ServiceName AppStdout "$LogPath\service-out.log" | Out-Null
& $InstalledNssm set $ServiceName AppStderr "$LogPath\service-error.log" | Out-Null
& $InstalledNssm set $ServiceName AppRotateFiles 1 | Out-Null
& $InstalledNssm set $ServiceName AppRotateBytes 1048576 | Out-Null
& $InstalledNssm set $ServiceName Start SERVICE_AUTO_START | Out-Null

# Configure service to interact with desktop (for visible browser window)
Write-Host "  [...] Configuring desktop interaction..." -ForegroundColor Yellow
& $InstalledNssm set $ServiceName Type SERVICE_INTERACTIVE_PROCESS | Out-Null

# Get current logged-in user for service account
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
Write-Host "  [OK] Service will run as: $currentUser" -ForegroundColor Green

# Configure restart on failure
& $InstalledNssm set $ServiceName AppExit Default Restart | Out-Null
& $InstalledNssm set $ServiceName AppRestartDelay 60000 | Out-Null

Write-Host "  [OK] Service installed: $ServiceName" -ForegroundColor Green
Write-Host ""

# Step 9: Start service
Write-Host "[9/9] Starting service..." -ForegroundColor Yellow
Start-Service -Name $ServiceName
Start-Sleep -Seconds 3

$service = Get-Service -Name $ServiceName
if ($service.Status -eq 'Running') {
    Write-Host "  [OK] Service started successfully" -ForegroundColor Green
} else {
    Write-Host "  [!] Service status: $($service.Status)" -ForegroundColor Yellow
    Write-Host "  Check logs at: $LogPath" -ForegroundColor Yellow
}
Write-Host ""

# Installation summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Installation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Installation Path:  $InstallPath" -ForegroundColor White
Write-Host "Service Name:       $ServiceName" -ForegroundColor White
Write-Host "Service Status:     $($service.Status)" -ForegroundColor White
Write-Host "Configuration:      $EnvFile" -ForegroundColor White
Write-Host "Logs:               $LogPath" -ForegroundColor White
Write-Host ""
Write-Host "Connecting to:      $ServerUrl" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  - Check service status: sc query $ServiceName" -ForegroundColor White
Write-Host "  - View logs: notepad $LogPath\service-out.log" -ForegroundColor White
Write-Host "  - Verify in admin dashboard at $ServerUrl" -ForegroundColor White
Write-Host ""

exit 0
