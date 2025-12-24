#
# TheiaCast Backend Installation Script for Windows
#

# Require Administrator
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Error "This script must be run as Administrator"
    exit 1
}

$InstallDir = "C:\Program Files\TheiaCast\Backend"
$ServiceName = "TheiaCastBackend"

Write-Host "================================" -ForegroundColor Green
Write-Host "TheiaCast Backend Installer" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""

# Stop existing service if running
if (Get-Service $ServiceName -ErrorAction SilentlyContinue) {
    Write-Host "Stopping existing service..."
    Stop-Service $ServiceName -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# Create installation directory
Write-Host "Creating installation directory at $InstallDir..."
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

# Copy files
Write-Host "Copying files..."
Copy-Item -Path "*" -Destination $InstallDir -Recurse -Force

# Prompt for configuration
Write-Host ""
Write-Host "Database Configuration:" -ForegroundColor Yellow
$dbHost = Read-Host "Enter PostgreSQL Host (default: localhost)"
if ([string]::IsNullOrWhiteSpace($dbHost)) { $dbHost = "localhost" }

$dbPort = Read-Host "Enter PostgreSQL Port (default: 5432)"
if ([string]::IsNullOrWhiteSpace($dbPort)) { $dbPort = "5432" }

$dbName = Read-Host "Enter PostgreSQL Database Name (default: theiacast)"
if ([string]::IsNullOrWhiteSpace($dbName)) { $dbName = "theiacast" }

$dbUser = Read-Host "Enter PostgreSQL Username"
$dbPass = Read-Host "Enter PostgreSQL Password" -AsSecureString
$dbPassPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPass))

Write-Host ""
Write-Host "JWT Configuration:" -ForegroundColor Yellow
$jwtSecret = Read-Host "Enter JWT Secret (min 32 characters, press Enter to generate)"
if ([string]::IsNullOrWhiteSpace($jwtSecret)) {
    $jwtSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 48 | ForEach-Object {[char]$_})
    Write-Host "Generated JWT Secret: $jwtSecret" -ForegroundColor Green
}

# Create appsettings.json
$appSettings = @"
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "ConnectionStrings": {
    "Default": "Host=$dbHost;Port=$dbPort;Database=$dbName;Username=$dbUser;Password=$dbPassPlain"
  },
  "Jwt": {
    "Secret": "$jwtSecret",
    "Issuer": "theiacast",
    "Audience": "theiacast-clients"
  }
}
"@

$appSettings | Out-File -FilePath "$InstallDir\appsettings.json" -Encoding UTF8
Write-Host "✓ Configuration saved" -ForegroundColor Green

# Find backend executable
$backendExe = Get-ChildItem -Path $InstallDir -Filter "*.Backend.exe" -File | Select-Object -First 1
if (-not $backendExe) {
    $backendExe = Get-ChildItem -Path $InstallDir -Filter "backend.exe" -File | Select-Object -First 1
}

if ($backendExe) {
    # Remove existing service
    if (Get-Service $ServiceName -ErrorAction SilentlyContinue) {
        Write-Host "Removing existing service..."
        sc.exe delete $ServiceName
        Start-Sleep -Seconds 2
    }

    # Create Windows Service
    Write-Host "Creating Windows Service..."
    $servicePath = $backendExe.FullName

    # Set proper permissions for service user
    $acl = Get-Acl $InstallDir
    $serviceAccount = "NT SERVICE\$ServiceName"
    $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule($serviceAccount, "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow")
    $acl.SetAccessRule($accessRule)
    Set-Acl $InstallDir $acl

    # Create service with virtual service account (NT SERVICE\ServiceName)
    # This provides security isolation without needing a password
    sc.exe create $ServiceName `
        binPath= "`"$servicePath`"" `
        start= auto `
        DisplayName= "TheiaCast Backend" `
        obj= "NT SERVICE\$ServiceName"

    # Set service description
    sc.exe description $ServiceName "TheiaCast Digital Signage Backend Server"

    # Configure service to restart on failure
    sc.exe failure $ServiceName reset= 86400 actions= restart/60000/restart/60000/restart/60000

    # Grant Log on as a service right (done automatically for virtual service accounts)

    # Set environment variables
    $env:ASPNETCORE_ENVIRONMENT = "Production"
    $env:ASPNETCORE_URLS = "http://0.0.0.0:5001"

    # Start service
    Write-Host "Starting service..."
    Start-Service $ServiceName

    Start-Sleep -Seconds 3

    # Check status
    $service = Get-Service $ServiceName
    if ($service.Status -eq 'Running') {
        Write-Host ""
        Write-Host "================================" -ForegroundColor Green
        Write-Host "Installation Complete!" -ForegroundColor Green
        Write-Host "================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Backend is running at: http://localhost:5001"
        Write-Host "Swagger UI: http://localhost:5001/swagger"
        Write-Host ""
        Write-Host "Service Name: $ServiceName"
        Write-Host "Install Location: $InstallDir"
        Write-Host ""
        Write-Host "Useful commands:"
        Write-Host "  View service: Get-Service $ServiceName"
        Write-Host "  Stop service: Stop-Service $ServiceName"
        Write-Host "  Start service: Start-Service $ServiceName"
        Write-Host "  Restart service: Restart-Service $ServiceName"
        Write-Host ""
    } else {
        Write-Error "Service failed to start. Check Event Viewer for details."
        exit 1
    }
} else {
    Write-Error "Backend executable not found in $InstallDir"
    exit 1
}
