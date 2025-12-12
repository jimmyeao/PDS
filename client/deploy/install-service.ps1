# Install Kiosk Client as Windows Service using NSSM
# Download NSSM from: https://nssm.cc/download

$serviceName = 'KioskClient'
$exePath = Join-Path $PSScriptRoot 'node_modules\.bin\node.exe'
$scriptPath = Join-Path $PSScriptRoot 'dist\index.js'
$workingDir = $PSScriptRoot

Write-Host 'Installing Kiosk Client as Windows Service...' -ForegroundColor Green
Write-Host 'Prerequisites: NSSM must be installed and in PATH' -ForegroundColor Yellow
Write-Host ''

# Check if NSSM is available
try {
    $nssmVersion = nssm version
    Write-Host "NSSM found: $nssmVersion" -ForegroundColor Green
} catch {
    Write-Host 'ERROR: NSSM not found. Please install NSSM first.' -ForegroundColor Red
    Write-Host 'Download from: https://nssm.cc/download' -ForegroundColor Yellow
    exit 1
}

# Install service
Write-Host 'Creating service...' -ForegroundColor Yellow
nssm install $serviceName node "$scriptPath"
nssm set $serviceName AppDirectory "$workingDir"
nssm set $serviceName DisplayName 'Kiosk Digital Signage Client'
nssm set $serviceName Description 'Digital signage client for kiosk displays'
nssm set $serviceName Start SERVICE_AUTO_START
nssm set $serviceName AppStdout "$workingDir\logs\stdout.log"
nssm set $serviceName AppStderr "$workingDir\logs\stderr.log"
nssm set $serviceName AppRotateFiles 1
nssm set $serviceName AppRotateSeconds 86400

Write-Host ''
Write-Host 'Service installed successfully!' -ForegroundColor Green
Write-Host 'To start the service, run: nssm start KioskClient' -ForegroundColor Cyan
Write-Host 'To stop the service, run: nssm stop KioskClient' -ForegroundColor Cyan
Write-Host 'To remove the service, run: nssm remove KioskClient confirm' -ForegroundColor Cyan
