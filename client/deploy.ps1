# Kiosk Client Deployment Script (PowerShell)
# This script prepares the client for deployment to Raspberry Pi
# Run this from the client directory
#
# Prerequisites: Workspace dependencies should already be installed

$ErrorActionPreference = "Stop"

Write-Host "Building client for deployment..." -ForegroundColor Green
Write-Host ""

# Get the project root (parent of client)
$projectRoot = Split-Path -Parent (Get-Location)
$clientDir = Get-Location

# Ensure we're in the client directory
if (-not (Test-Path "package.json")) {
    Write-Host "Error: Must run this script from the client directory" -ForegroundColor Red
    exit 1
}

# Check if workspace dependencies are installed
if (-not (Test-Path "$projectRoot/node_modules")) {
    Write-Host "Error: Dependencies not installed at root. Workspace node_modules not found." -ForegroundColor Red
    exit 1
}

# Build shared package
Write-Host "Building shared package..." -ForegroundColor Cyan
Push-Location "$projectRoot/shared"
try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Shared build failed with exit code $LASTEXITCODE" }
    Write-Host "  Done!" -ForegroundColor Green
} catch {
    Write-Host "Error building shared package: $_" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

# Build client
Write-Host "Building client..." -ForegroundColor Cyan
Push-Location $clientDir
try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Client build failed with exit code $LASTEXITCODE" }
    Write-Host "  Done!" -ForegroundColor Green
} catch {
    Write-Host "Error building client: $_" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

# Create a tarball of the shared package
Write-Host "Packing shared package..." -ForegroundColor Cyan
Push-Location "$projectRoot/shared"
$packOutput = & npm pack 2>&1
$sharedTarball = ($packOutput | Where-Object { $_ -like "*.tgz" }) | Select-Object -Last 1
if (-not $sharedTarball) {
    Write-Host "Error: Failed to create tarball" -ForegroundColor Red
    Write-Host "Output: $packOutput" -ForegroundColor Yellow
    Pop-Location
    exit 1
}
$sharedTarballPath = Join-Path (Get-Location) $sharedTarball
Write-Host "  Created: $sharedTarball" -ForegroundColor Green
Pop-Location

# Create deployment directory
Write-Host "Creating deployment package..." -ForegroundColor Cyan
$deployDir = Join-Path $clientDir "deploy"
if (Test-Path $deployDir) {
    Write-Host "  Removing existing deploy folder..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $deployDir
}
New-Item -ItemType Directory -Path $deployDir | Out-Null

# Copy necessary files
Write-Host "Copying files..." -ForegroundColor Cyan
Copy-Item -Path (Join-Path $clientDir "dist") -Destination $deployDir -Recurse
Copy-Item -Path (Join-Path $clientDir "package.json") -Destination $deployDir
Copy-Item -Path (Join-Path $clientDir ".env.example") -Destination $deployDir
Write-Host "  Copied dist/, package.json, .env.example" -ForegroundColor Green

# Also copy README if it exists
if (Test-Path (Join-Path $clientDir "README.md")) {
    Copy-Item -Path (Join-Path $clientDir "README.md") -Destination $deployDir
    Write-Host "  Copied README.md" -ForegroundColor Green
}

# Install production dependencies in deployment folder
Write-Host "Installing production dependencies..." -ForegroundColor Cyan
Push-Location $deployDir

# Install the shared package from tarball first
Write-Host "  Installing @kiosk/shared from tarball..." -ForegroundColor Cyan
npm install $sharedTarballPath --save

# Install other dependencies
Write-Host "  Installing other dependencies..." -ForegroundColor Cyan
npm install --omit=dev

Pop-Location

# Clean up the tarball
Remove-Item $sharedTarballPath -Force

Write-Host ""
Write-Host "SUCCESS! Deployment package created in client/deploy/" -ForegroundColor Green
Write-Host ""
Write-Host "Package contents:" -ForegroundColor Cyan
Write-Host "  - dist/           (compiled JavaScript)" -ForegroundColor Gray
Write-Host "  - node_modules/   (production dependencies)" -ForegroundColor Gray
Write-Host "  - package.json    (package metadata)" -ForegroundColor Gray
Write-Host "  - .env.example    (configuration template)" -ForegroundColor Gray
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Copy the 'deploy' folder to your Raspberry Pi:" -ForegroundColor White
Write-Host "     scp -r deploy noroot@loungepi:~/kiosk-client" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. On the Pi, create .env from .env.example:" -ForegroundColor White
Write-Host "     cd ~/kiosk-client && cp .env.example .env && nano .env" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Edit .env with your server details, then run:" -ForegroundColor White
Write-Host "     node dist/index.js" -ForegroundColor Gray
Write-Host ""
