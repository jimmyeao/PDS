# Linux/Pi Deployment Script (run from Windows)
# This creates a deployment package for Linux/Raspberry Pi

Write-Host "================================" -ForegroundColor Cyan
Write-Host "Kiosk Client - Linux/Pi Deployment" -ForegroundColor Cyan
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
Copy-Item -Path "README.md" -Destination "$deployDir\" -ErrorAction SilentlyContinue

# Copy shared package
New-Item -ItemType Directory -Path "$deployDir\node_modules\@kiosk\shared" -Force | Out-Null
Copy-Item -Path "..\shared\dist" -Destination "$deployDir\node_modules\@kiosk\shared\dist" -Recurse
Copy-Item -Path "..\shared\package.json" -Destination "$deployDir\node_modules\@kiosk\shared\"

# Install production dependencies
Write-Host "Installing production dependencies..." -ForegroundColor Yellow
Set-Location $deployDir
npm install --production --legacy-peer-deps

Set-Location ..

Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""
Write-Host "Deployment package created in: .\deploy" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Transfer to Pi: scp -r deploy noroot@PI_IP:~/kiosk-client" -ForegroundColor White
Write-Host "2. On Pi: sudo systemctl stop kiosk-client" -ForegroundColor White
Write-Host "3. On Pi: sudo systemctl start kiosk-client" -ForegroundColor White
Write-Host ""
