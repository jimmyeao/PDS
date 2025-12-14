# Windows Deployment Script for Kiosk Client
# This script prepares the client for deployment to Windows machines (Intel NUCs, etc.)

Write-Host "================================" -ForegroundColor Cyan
Write-Host "Kiosk Client - Windows Deployment" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Create deploy directory
$deployDir = ".\deploy"
Write-Host "Creating deployment directory..." -ForegroundColor Yellow
if (Test-Path $deployDir) {
    Remove-Item -Recurse -Force $deployDir
}
New-Item -ItemType Directory -Path $deployDir | Out-Null

# Build shared package
Write-Host "Building shared package..." -ForegroundColor Yellow
Set-Location ..\shared
npm install
npm run build

# Build client
Write-Host "Building client..." -ForegroundColor Yellow
Set-Location ..\client
npm install
npm run build

# Copy necessary files to deploy directory
Write-Host "Copying files to deploy directory..." -ForegroundColor Yellow
Copy-Item -Path "dist" -Destination "$deployDir\dist" -Recurse
Copy-Item -Path "package.json" -Destination "$deployDir\"
Copy-Item -Path ".env.example" -Destination "$deployDir\"
# Copy .env if it exists, otherwise warn
if (Test-Path "deploy\.env") {
    Copy-Item -Path "deploy\.env" -Destination "$deployDir\.env"
} else {
    Write-Host "Warning: deploy\.env not found. Using .env.example." -ForegroundColor Yellow
}
Copy-Item -Path "README-WINDOWS.md" -Destination "$deployDir\README.md" -ErrorAction SilentlyContinue

# Copy shared package
New-Item -ItemType Directory -Path "$deployDir\node_modules\@kiosk\shared" -Force | Out-Null
Copy-Item -Path "..\shared\dist" -Destination "$deployDir\node_modules\@kiosk\shared\dist" -Recurse
Copy-Item -Path "..\shared\package.json" -Destination "$deployDir\node_modules\@kiosk\shared\"

# Install production dependencies
Write-Host "Installing production dependencies..." -ForegroundColor Yellow
Set-Location $deployDir
npm install --production --legacy-peer-deps

# Create startup script
Write-Host "Creating startup script..." -ForegroundColor Yellow
@"
@echo off
echo Starting Kiosk Client...
node dist\index.js
"@ | Out-File -FilePath "start.bat" -Encoding ASCII

# Create PowerShell startup script
@"
# Kiosk Client Startup Script
Write-Host 'Starting Kiosk Digital Signage Client...' -ForegroundColor Green
node dist\index.js
"@ | Out-File -FilePath "start.ps1" -Encoding UTF8

# Create service installer script
@"
# Install Kiosk Client as Windows Service using NSSM
# Download NSSM from: https://nssm.cc/download

`$serviceName = 'KioskClient'
`$exePath = Join-Path `$PSScriptRoot 'node_modules\.bin\node.exe'
`$scriptPath = Join-Path `$PSScriptRoot 'dist\index.js'
`$workingDir = `$PSScriptRoot

Write-Host 'Installing Kiosk Client as Windows Service...' -ForegroundColor Green
Write-Host 'Prerequisites: NSSM must be installed and in PATH' -ForegroundColor Yellow
Write-Host ''

# Check if NSSM is available
try {
    `$nssmVersion = nssm version
    Write-Host "NSSM found: `$nssmVersion" -ForegroundColor Green
} catch {
    Write-Host 'ERROR: NSSM not found. Please install NSSM first.' -ForegroundColor Red
    Write-Host 'Download from: https://nssm.cc/download' -ForegroundColor Yellow
    exit 1
}

# Install service
Write-Host 'Creating service...' -ForegroundColor Yellow
nssm install `$serviceName node "`$scriptPath"
nssm set `$serviceName AppDirectory "`$workingDir"
nssm set `$serviceName DisplayName 'Kiosk Digital Signage Client'
nssm set `$serviceName Description 'Digital signage client for kiosk displays'
nssm set `$serviceName Start SERVICE_AUTO_START
nssm set `$serviceName AppStdout "`$workingDir\logs\stdout.log"
nssm set `$serviceName AppStderr "`$workingDir\logs\stderr.log"
nssm set `$serviceName AppRotateFiles 1
nssm set `$serviceName AppRotateSeconds 86400

Write-Host ''
Write-Host 'Service installed successfully!' -ForegroundColor Green
Write-Host 'To start the service, run: nssm start KioskClient' -ForegroundColor Cyan
Write-Host 'To stop the service, run: nssm stop KioskClient' -ForegroundColor Cyan
Write-Host 'To remove the service, run: nssm remove KioskClient confirm' -ForegroundColor Cyan
"@ | Out-File -FilePath "install-service.ps1" -Encoding UTF8

Set-Location ..

Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""
Write-Host "Deployment package created in: .\deploy" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Copy the 'deploy' folder to your Windows machine (Intel NUC, etc.)" -ForegroundColor White
Write-Host "2. On the target machine, copy .env.example to .env and configure it" -ForegroundColor White
Write-Host "3. Run start.bat or start.ps1 to test the client" -ForegroundColor White
Write-Host "4. (Optional) Run install-service.ps1 to install as Windows Service" -ForegroundColor White
Write-Host ""
