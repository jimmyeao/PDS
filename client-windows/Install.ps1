<#
.SYNOPSIS
    Installs PDS Kiosk Client as a Windows Service

.DESCRIPTION
    Builds, publishes, and installs the PDS Kiosk Client as a Windows Service.
    Requires Administrator privileges.

.PARAMETER ServerUrl
    The URL of the PDS server (e.g., http://192.168.0.57:5001)

.PARAMETER DeviceId
    Unique identifier for this device (e.g., office-display-1)

.PARAMETER DeviceToken
    Authentication token for this device (obtain from admin UI)

.PARAMETER InstallPath
    Installation directory (default: C:\Program Files\PDS\KioskClient)

.PARAMETER ServiceName
    Windows Service name (default: PDSKioskClient)

.EXAMPLE
    .\Install.ps1 -ServerUrl "http://192.168.0.57:5001" -DeviceId "office-kiosk" -DeviceToken "abc123xyz"

.EXAMPLE
    .\Install.ps1 -ServerUrl "http://server:5001" -DeviceId "lobby-display" -DeviceToken "token123" -InstallPath "C:\PDS"
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$ServerUrl,

    [Parameter(Mandatory=$true)]
    [string]$DeviceId,

    [Parameter(Mandatory=$true)]
    [string]$DeviceToken,

    [Parameter(Mandatory=$false)]
    [string]$InstallPath = "C:\Program Files\PDS\KioskClient",

    [Parameter(Mandatory=$false)]
    [string]$ServiceName = "PDSKioskClient"
)

# Require Administrator
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Error "This script must be run as Administrator"
    exit 1
}

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "PDS Kiosk Client Installer" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Join-Path $ScriptDir "KioskClient.Service"
$PublishDir = Join-Path $ScriptDir "publish"

Write-Host "[1/8] Validating environment..." -ForegroundColor Yellow

# Check if dotnet is installed
try {
    $dotnetVersion = dotnet --version
    Write-Host "  ✓ .NET SDK found: $dotnetVersion" -ForegroundColor Green
} catch {
    Write-Error ".NET SDK not found. Please install .NET 8.0 or later from https://dotnet.microsoft.com/download"
    exit 1
}

# Validate parameters
if (-not $ServerUrl.StartsWith("http://") -and -not $ServerUrl.StartsWith("https://")) {
    Write-Error "ServerUrl must start with http:// or https://"
    exit 1
}

Write-Host "  Server URL: $ServerUrl" -ForegroundColor Gray
Write-Host "  Device ID: $DeviceId" -ForegroundColor Gray
Write-Host "  Install Path: $InstallPath" -ForegroundColor Gray
Write-Host "  Service Name: $ServiceName" -ForegroundColor Gray
Write-Host ""

# Stop existing service if running
Write-Host "[2/8] Checking for existing service..." -ForegroundColor Yellow
$existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existingService) {
    Write-Host "  Found existing service: $($existingService.Status)" -ForegroundColor Gray

    if ($existingService.Status -eq "Running") {
        Write-Host "  Stopping service..." -ForegroundColor Gray
        Stop-Service -Name $ServiceName -Force
        Start-Sleep -Seconds 2
    }

    Write-Host "  Removing existing service..." -ForegroundColor Gray
    sc.exe delete $ServiceName | Out-Null
    Start-Sleep -Seconds 2
    Write-Host "  ✓ Existing service removed" -ForegroundColor Green
} else {
    Write-Host "  ✓ No existing service found" -ForegroundColor Green
}
Write-Host ""

# Clean previous publish
Write-Host "[3/8] Cleaning previous build..." -ForegroundColor Yellow
if (Test-Path $PublishDir) {
    Remove-Item -Path $PublishDir -Recurse -Force
    Write-Host "  ✓ Cleaned publish directory" -ForegroundColor Green
} else {
    Write-Host "  ✓ No previous build found" -ForegroundColor Green
}
Write-Host ""

# Build and publish
Write-Host "[4/8] Building project..." -ForegroundColor Yellow
Push-Location $ProjectDir
try {
    dotnet publish -c Release -o $PublishDir --no-self-contained
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed with exit code $LASTEXITCODE"
    }
    Write-Host "  ✓ Build completed successfully" -ForegroundColor Green
} catch {
    Write-Error "Build failed: $_"
    Pop-Location
    exit 1
}
Pop-Location
Write-Host ""

# Install Playwright browsers
Write-Host "[5/8] Installing Playwright browsers..." -ForegroundColor Yellow
Push-Location $PublishDir
try {
    # Run playwright install command
    & ".\playwright.ps1" install chromium
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Playwright browsers installed" -ForegroundColor Green
    } else {
        Write-Warning "  Playwright installation completed with warnings (code: $LASTEXITCODE)"
        Write-Host "  Continuing with installation..." -ForegroundColor Gray
    }
} catch {
    Write-Warning "Playwright browser installation encountered an issue: $_"
    Write-Host "  Service will still be installed, but may need manual browser setup" -ForegroundColor Gray
}
Pop-Location
Write-Host ""

# Create installation directory
Write-Host "[6/8] Installing to $InstallPath..." -ForegroundColor Yellow
if (-not (Test-Path $InstallPath)) {
    New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
    Write-Host "  ✓ Created installation directory" -ForegroundColor Green
}

# Copy files
Copy-Item -Path "$PublishDir\*" -Destination $InstallPath -Recurse -Force
Write-Host "  ✓ Files copied to installation directory" -ForegroundColor Green

# Create appsettings.json with provided parameters
$appsettingsPath = Join-Path $InstallPath "appsettings.json"
$appsettings = @{
    Logging = @{
        LogLevel = @{
            Default = "Information"
            "Microsoft.Hosting.Lifetime" = "Information"
        }
    }
    Kiosk = @{
        ServerUrl = $ServerUrl
        DeviceId = $DeviceId
        DeviceToken = $DeviceToken
        HealthReportIntervalMs = 60000
        ScreenshotIntervalMs = 300000
        Headless = $false
        KioskMode = $false
        ViewportWidth = 1920
        ViewportHeight = 1080
    }
}

$appsettings | ConvertTo-Json -Depth 10 | Set-Content -Path $appsettingsPath -Encoding UTF8
Write-Host "  ✓ Configuration file created" -ForegroundColor Green
Write-Host ""

# Register Windows Service
Write-Host "[7/8] Registering Windows Service..." -ForegroundColor Yellow
$exePath = Join-Path $InstallPath "KioskClient.Service.exe"

$serviceParams = @{
    Name = $ServiceName
    BinaryPathName = "`"$exePath`""
    DisplayName = "PDS Kiosk Client"
    Description = "Digital signage client for PDS (Playlist Display System)"
    StartupType = "Automatic"
}

New-Service @serviceParams | Out-Null
Write-Host "  ✓ Service registered: $ServiceName" -ForegroundColor Green
Write-Host ""

# Start service
Write-Host "[8/8] Starting service..." -ForegroundColor Yellow
Start-Service -Name $ServiceName
Start-Sleep -Seconds 3

$service = Get-Service -Name $ServiceName
if ($service.Status -eq "Running") {
    Write-Host "  ✓ Service started successfully" -ForegroundColor Green
} else {
    Write-Warning "Service status: $($service.Status)"
    Write-Host "  Check Windows Event Viewer for details" -ForegroundColor Gray
}
Write-Host ""

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Installation Complete!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Service Name: $ServiceName" -ForegroundColor Gray
Write-Host "Install Path: $InstallPath" -ForegroundColor Gray
Write-Host "Status: $($service.Status)" -ForegroundColor Gray
Write-Host ""
Write-Host "Useful Commands:" -ForegroundColor Cyan
Write-Host "  View logs:     Get-EventLog -LogName Application -Source KioskClient -Newest 50" -ForegroundColor Gray
Write-Host "  Stop service:  Stop-Service -Name $ServiceName" -ForegroundColor Gray
Write-Host "  Start service: Start-Service -Name $ServiceName" -ForegroundColor Gray
Write-Host "  Service status: Get-Service -Name $ServiceName" -ForegroundColor Gray
Write-Host "  Uninstall:     sc.exe delete $ServiceName" -ForegroundColor Gray
Write-Host ""
