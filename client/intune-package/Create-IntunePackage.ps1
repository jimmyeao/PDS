#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Creates an Intune Win32 app package for Kiosk Client deployment.

.DESCRIPTION
    Automates the process of preparing source files and creating an .intunewin package
    for Microsoft Intune deployment.

.PARAMETER IncludeNodeJs
    Bundle Node.js runtime in the package (recommended, adds ~50MB)

.PARAMETER OutputPath
    Where to create the package (default: C:\IntunePackaging\KioskClient)

.PARAMETER UseService
    Install as Windows service using NSSM (browser not visible due to Session 0 isolation)
    Default: False (uses startup program, browser visible on desktop)

.EXAMPLE
    .\Create-IntunePackage.ps1 -IncludeNodeJs

.EXAMPLE
    .\Create-IntunePackage.ps1 -UseService -IncludeNodeJs

.EXAMPLE
    .\Create-IntunePackage.ps1 -OutputPath "D:\Packages\Kiosk"
#>

param(
    [switch]$IncludeNodeJs = $false,
    [switch]$UseService = $false,
    [string]$OutputPath = "C:\IntunePackaging\KioskClient"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Intune Package Creator" -ForegroundColor Cyan
Write-Host "  Kiosk Digital Signage Client" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Paths
$ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$ClientPath = Split-Path -Parent $ScriptPath
$RootPath = Split-Path -Parent $ClientPath
$SourceFolder = "$OutputPath\Source"
$OutputFolder = "$OutputPath\Output"
$IntuneToolPath = "C:\IntuneTools\IntuneWinAppUtil.exe"

# Step 1: Check prerequisites
Write-Host "[1/6] Checking prerequisites..." -ForegroundColor Yellow

# Check if client is built
if (-not (Test-Path "$ClientPath\dist\index.js")) {
    Write-Host "[ERROR] Client not built. Run 'npm run build' first." -ForegroundColor Red
    Write-Host "  cd $ClientPath" -ForegroundColor Yellow
    Write-Host "  npm run build" -ForegroundColor Yellow
    exit 1
}
Write-Host "  [OK] Client built" -ForegroundColor Green

# Check for IntuneWinAppUtil
if (-not (Test-Path $IntuneToolPath)) {
    Write-Host "[!] IntuneWinAppUtil.exe not found" -ForegroundColor Yellow
    Write-Host "  Downloading from GitHub..." -ForegroundColor Yellow

    New-Item -ItemType Directory -Path "C:\IntuneTools" -Force | Out-Null

    try {
        $url = "https://github.com/microsoft/Microsoft-Win32-Content-Prep-Tool/raw/master/IntuneWinAppUtil.exe"
        Invoke-WebRequest -Uri $url -OutFile $IntuneToolPath -UseBasicParsing
        Write-Host "  [OK] IntuneWinAppUtil downloaded" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Failed to download IntuneWinAppUtil" -ForegroundColor Red
        Write-Host "  Download manually from:" -ForegroundColor Yellow
        Write-Host "  https://github.com/microsoft/Microsoft-Win32-Content-Prep-Tool" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "  [OK] IntuneWinAppUtil found" -ForegroundColor Green
}
Write-Host ""

# Step 2: Clean and create directories
Write-Host "[2/6] Preparing directories..." -ForegroundColor Yellow

if (Test-Path $SourceFolder) {
    Remove-Item $SourceFolder -Recurse -Force
}
New-Item -ItemType Directory -Path $SourceFolder -Force | Out-Null
New-Item -ItemType Directory -Path $OutputFolder -Force | Out-Null

Write-Host "  [OK] Directories created" -ForegroundColor Green
Write-Host "      Source: $SourceFolder" -ForegroundColor Gray
Write-Host "      Output: $OutputFolder" -ForegroundColor Gray
Write-Host ""

# Step 3: Copy installation scripts
Write-Host "[3/6] Copying installation scripts..." -ForegroundColor Yellow

if ($UseService) {
    # Service mode: Install as Windows service (browser not visible)
    Write-Host "  [INFO] Using Windows service installation (NSSM)" -ForegroundColor Cyan
    Copy-Item "$ScriptPath\Install.ps1" -Destination $SourceFolder -Force
    Write-Host "  [OK] Install.ps1 (service installer)" -ForegroundColor Green

    if (Test-Path "$ScriptPath\nssm.exe") {
        Copy-Item "$ScriptPath\nssm.exe" -Destination $SourceFolder -Force
        Write-Host "  [OK] nssm.exe (service manager)" -ForegroundColor Green
    } else {
        Write-Host "  [!] WARNING: nssm.exe not found, service install will fail" -ForegroundColor Yellow
    }
} else {
    # Startup mode: Install as startup program (browser visible on desktop)
    Write-Host "  [INFO] Using startup program installation (browser visible)" -ForegroundColor Cyan
    Copy-Item "$ScriptPath\Install-Startup.ps1" -Destination "$SourceFolder\Install.ps1" -Force
    Write-Host "  [OK] Install-Startup.ps1 -> Install.ps1" -ForegroundColor Green
}

Copy-Item "$ScriptPath\Uninstall.ps1" -Destination $SourceFolder -Force
Write-Host "  [OK] Uninstall.ps1" -ForegroundColor Green

Copy-Item "$ScriptPath\Detection.ps1" -Destination $SourceFolder -Force
Write-Host "  [OK] Detection.ps1" -ForegroundColor Green

Write-Host ""

# Step 4: Copy client files
Write-Host "[4/6] Copying client application..." -ForegroundColor Yellow

Write-Host "  [...] Copying dist/ ..." -ForegroundColor Gray
Copy-Item "$ClientPath\dist" -Destination "$SourceFolder\dist" -Recurse -Force
Write-Host "  [OK] dist/ copied" -ForegroundColor Green

Write-Host "  [...] Copying package.json ..." -ForegroundColor Gray
Copy-Item "$ClientPath\package.json" -Destination $SourceFolder -Force
Write-Host "  [OK] package.json copied" -ForegroundColor Green

Write-Host "  [...] Installing production dependencies only..." -ForegroundColor Gray

# Skip Puppeteer's Chromium download (saves ~200MB!)
# Install.ps1 will use system Chrome or download if needed
$env:PUPPETEER_SKIP_DOWNLOAD = "true"

# Create a temporary directory for isolated install
$TempInstallDir = "$env:TEMP\kiosk-client-isolated-$(Get-Random)"
New-Item -ItemType Directory -Path $TempInstallDir -Force | Out-Null

# Create minimal package.json with ONLY runtime dependencies (no workspace packages)
Write-Host "      Creating minimal package.json (runtime only)..." -ForegroundColor Gray

$minimalPackageJson = @{
    name = "@kiosk/client"
    version = "1.0.0"
    dependencies = @{
        puppeteer = "^24.15.0"
        dotenv = "^16.4.7"
        systeminformation = "^5.23.22"
        ws = "^8.18.0"
    }
} | ConvertTo-Json -Depth 10

$minimalPackageJson | Out-File "$TempInstallDir\package.json" -Encoding UTF8 -ErrorAction Stop

# Install in isolated directory (no workspace, no @kiosk/shared)
$npmLogFile = "$TempInstallDir\npm-install.log"
$npmExitCode = -1

Write-Host "      Running npm install (4 runtime packages only)..." -ForegroundColor Gray

# Run npm install through cmd.exe (npm is a batch file on Windows)
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "cmd.exe"
$psi.Arguments = "/c npm install --omit=dev --no-audit --no-fund"
$psi.WorkingDirectory = $TempInstallDir
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true

$process = New-Object System.Diagnostics.Process
$process.StartInfo = $psi

try {
    $process.Start() | Out-Null

    # Read output streams asynchronously to avoid deadlock
    $stdOutTask = $process.StandardOutput.ReadToEndAsync()
    $stdErrTask = $process.StandardError.ReadToEndAsync()

    $process.WaitForExit()

    $npmExitCode = $process.ExitCode
    $npmStdOut = $stdOutTask.Result
    $npmStdErr = $stdErrTask.Result

    # Save output to log file for debugging
    "Exit Code: $npmExitCode`n`nStdOut:`n$npmStdOut`n`nStdErr:`n$npmStdErr" | Out-File $npmLogFile -Encoding UTF8

} catch {
    Write-Host "  [!] Failed to run npm: $($_.Exception.Message)" -ForegroundColor Red
    $npmExitCode = 999
    $npmStdOut = ""
    $npmStdErr = $_.Exception.Message
}

# Check if node_modules was created (npm may have succeeded despite cleanup warnings)
# Note: npm returns exit code 1 even when packages install successfully if cleanup fails
$nodeModulesPath = "$TempInstallDir\node_modules"
Write-Host "      Checking for installed packages..." -ForegroundColor Gray

# Give npm a moment to finish cleanup attempts
Start-Sleep -Milliseconds 500

if (Test-Path $nodeModulesPath) {
    # Count packages installed
    $packageDirs = Get-ChildItem $nodeModulesPath -Directory -ErrorAction SilentlyContinue
    $packageCount = ($packageDirs | Measure-Object).Count

    if ($packageCount -gt 0) {
        # Success! Copy minimal node_modules to source folder
        Write-Host "      Copying minimal node_modules ($packageCount packages)..." -ForegroundColor Gray

        # Copy with error handling for locked files
        Copy-Item $nodeModulesPath -Destination "$SourceFolder\node_modules" -Recurse -Force -ErrorAction Stop

        $nodeModulesSize = (Get-ChildItem "$SourceFolder\node_modules" -Recurse -ErrorAction SilentlyContinue |
                           Measure-Object -Property Length -Sum).Sum / 1MB
        Write-Host "  [OK] Production dependencies installed ($packageCount packages, $([math]::Round($nodeModulesSize, 2)) MB)" -ForegroundColor Green

        # Show informational message about cleanup warnings
        if ($npmExitCode -ne 0) {
            Write-Host "  [INFO] npm completed with cleanup warnings (non-critical, packages installed successfully)" -ForegroundColor Cyan
        }
    } else {
        Write-Host "  [!] node_modules is empty" -ForegroundColor Red
        Write-Host "  [!] Exit code: $npmExitCode" -ForegroundColor Yellow
        Write-Host "" -ForegroundColor Yellow

        # Show stdout if present
        if ($npmStdOut -and $npmStdOut.Trim()) {
            Write-Host "  npm stdout:" -ForegroundColor Yellow
            $npmStdOut.Split("`n") | Select-Object -First 15 | ForEach-Object {
                Write-Host "    $_" -ForegroundColor Gray
            }
        }

        # Show stderr if present
        if ($npmStdErr -and $npmStdErr.Trim()) {
            Write-Host "  npm stderr:" -ForegroundColor Yellow
            $npmStdErr.Split("`n") | Select-Object -First 15 | ForEach-Object {
                Write-Host "    $_" -ForegroundColor Gray
            }
        }

        Write-Host "" -ForegroundColor Yellow
        Write-Host "  Troubleshooting:" -ForegroundColor Yellow
        Write-Host "  - Temp directory: $TempInstallDir" -ForegroundColor Gray
        Write-Host "  - Log file: $npmLogFile" -ForegroundColor Gray
        Write-Host "  - Temp directory left for investigation" -ForegroundColor Gray
        exit 1
    }
} else {
    Write-Host "  [!] npm install failed - node_modules not created (exit code: $npmExitCode)" -ForegroundColor Red
    Write-Host "" -ForegroundColor Yellow

    # Show stdout if present
    if ($npmStdOut -and $npmStdOut.Trim()) {
        Write-Host "  npm stdout:" -ForegroundColor Yellow
        $npmStdOut.Split("`n") | Select-Object -First 10 | ForEach-Object {
            Write-Host "    $_" -ForegroundColor Gray
        }
    }

    # Show stderr if present
    if ($npmStdErr -and $npmStdErr.Trim()) {
        Write-Host "  npm stderr:" -ForegroundColor Yellow
        $npmStdErr.Split("`n") | Select-Object -First 10 | ForEach-Object {
            Write-Host "    $_" -ForegroundColor Gray
        }
    }

    Write-Host "" -ForegroundColor Yellow
    Write-Host "  Troubleshooting:" -ForegroundColor Yellow
    Write-Host "  - Temp directory: $TempInstallDir" -ForegroundColor Gray
    Write-Host "  - Log file: $npmLogFile" -ForegroundColor Gray
    Write-Host "  - Try running manually: cd `"$TempInstallDir`"; npm install" -ForegroundColor Gray

    # Don't cleanup temp dir so user can investigate
    Write-Host "  - Temp directory left for investigation" -ForegroundColor Gray
    exit 1
}

# Cleanup temp directory on success
if (Test-Path $TempInstallDir) {
    Remove-Item $TempInstallDir -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ""

# Step 5: Optional - Bundle Node.js
if ($IncludeNodeJs) {
    Write-Host "[5/6] Bundling Node.js runtime..." -ForegroundColor Yellow

    $NodeUrl = "https://nodejs.org/dist/v20.18.1/node-v20.18.1-win-x64.zip"
    $NodeZip = "$env:TEMP\nodejs.zip"

    Write-Host "  [...] Downloading Node.js v20.18.1 (~50MB)..." -ForegroundColor Gray
    Invoke-WebRequest -Uri $NodeUrl -OutFile $NodeZip -UseBasicParsing

    Write-Host "  [...] Extracting..." -ForegroundColor Gray
    Expand-Archive -Path $NodeZip -DestinationPath $env:TEMP -Force

    Write-Host "  [...] Copying to source folder..." -ForegroundColor Gray
    Copy-Item "$env:TEMP\node-v20.18.1-win-x64" -Destination "$SourceFolder\nodejs" -Recurse -Force

    # Cleanup
    Remove-Item $NodeZip -Force -ErrorAction SilentlyContinue
    Remove-Item "$env:TEMP\node-v20.18.1-win-x64" -Recurse -Force -ErrorAction SilentlyContinue

    Write-Host "  [OK] Node.js bundled (50 MB)" -ForegroundColor Green
} else {
    Write-Host "[5/6] Skipping Node.js bundle (will download during install)" -ForegroundColor Yellow
    Write-Host "  Tip: Use -IncludeNodeJs to bundle Node.js for faster deployment" -ForegroundColor Gray
}
Write-Host ""

# Step 6: Create .intunewin package
Write-Host "[6/6] Creating .intunewin package..." -ForegroundColor Yellow

# Calculate total size
$totalSize = (Get-ChildItem $SourceFolder -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "  [INFO] Total source size: $([math]::Round($totalSize, 2)) MB" -ForegroundColor Cyan

Write-Host "  [...] Running IntuneWinAppUtil..." -ForegroundColor Gray

# Run the tool
& $IntuneToolPath `
    -c $SourceFolder `
    -s "Install.ps1" `
    -o $OutputFolder `
    -q

if ($LASTEXITCODE -eq 0) {
    $packagePath = "$OutputFolder\Install.intunewin"
    $packageSize = (Get-Item $packagePath).Length / 1MB

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Package Created Successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Package Location:" -ForegroundColor White
    Write-Host "  $packagePath" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Package Size:" -ForegroundColor White
    Write-Host "  $([math]::Round($packageSize, 2)) MB" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Yellow
    Write-Host "  1. Go to Microsoft Endpoint Manager (https://endpoint.microsoft.com/)" -ForegroundColor White
    Write-Host "  2. Navigate to Apps > Windows > Add" -ForegroundColor White
    Write-Host "  3. Select 'Windows app (Win32)'" -ForegroundColor White
    Write-Host "  4. Upload: $packagePath" -ForegroundColor White
    Write-Host ""
    Write-Host "Configuration:" -ForegroundColor Yellow
    Write-Host "  Install command: powershell.exe -ExecutionPolicy Bypass -File Install.ps1 -ServerUrl ""http://YOUR-SERVER:5001"" -DeviceToken ""YOUR-TOKEN""" -ForegroundColor White
    Write-Host "  Uninstall command: powershell.exe -ExecutionPolicy Bypass -File Uninstall.ps1" -ForegroundColor White
    Write-Host "  Detection script: Detection.ps1" -ForegroundColor White
    Write-Host ""
    Write-Host "See INTUNE-DEPLOYMENT-GUIDE.md for detailed instructions" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "[ERROR] Package creation failed" -ForegroundColor Red
    Write-Host "  Check the output above for errors" -ForegroundColor Yellow
    exit 1
}

exit 0
