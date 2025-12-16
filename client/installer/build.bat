@echo off
REM Kiosk Client MSI Installer Build Script
REM Requires: WiX Toolset 3.11+ installed and in PATH
REM Usage: build.bat [version]
REM Example: build.bat 1.0.1

setlocal EnableDelayedExpansion

echo ========================================
echo  Kiosk Client MSI Installer Builder
echo ========================================
echo.

REM Configuration
set SCRIPT_DIR=%~dp0
set CLIENT_DIR=%SCRIPT_DIR%..
set ROOT_DIR=%CLIENT_DIR%\..
set DIST_DIR=%CLIENT_DIR%\dist
set NODE_MODULES_DIR=%ROOT_DIR%\node_modules
set INSTALLER_DIR=%SCRIPT_DIR%
set NODEJS_VERSION=20.18.1
set NODEJS_URL=https://nodejs.org/dist/v%NODEJS_VERSION%/node-v%NODEJS_VERSION%-win-x64.zip
set NODEJS_DIR=%INSTALLER_DIR%nodejs
set NODEJS_ARCHIVE=%INSTALLER_DIR%nodejs.zip
set WIX_BIN=C:\Program Files (x86)\WiX Toolset v3.14\bin

REM Check for version parameter
if "%~1"=="" (
    set VERSION=1.0.0.0
    echo [INFO] No version specified, using default: 1.0.0.0
) else (
    set VERSION=%~1
    echo [INFO] Building version: %VERSION%
)
echo.

REM ==========================================
REM Step 1: Check Prerequisites
REM ==========================================
echo [1/10] Checking prerequisites...

REM Check for WiX tools
if not exist "%WIX_BIN%\candle.exe" (
    echo [ERROR] candle.exe not found at %WIX_BIN%
    echo [ERROR] Please install WiX Toolset or update WIX_BIN path in build.bat
    exit /b 1
)

if not exist "%WIX_BIN%\light.exe" (
    echo [ERROR] light.exe not found at %WIX_BIN%
    echo [ERROR] Please install WiX Toolset or update WIX_BIN path in build.bat
    exit /b 1
)

if not exist "%WIX_BIN%\heat.exe" (
    echo [ERROR] heat.exe not found at %WIX_BIN%
    echo [ERROR] Please install WiX Toolset or update WIX_BIN path in build.bat
    exit /b 1
)

echo [OK] WiX Toolset found at %WIX_BIN%
echo.

REM ==========================================
REM Step 2: Build TypeScript Client
REM ==========================================
echo [2/10] Building TypeScript client...
cd /d "%CLIENT_DIR%"

call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] TypeScript build failed
    exit /b 1
)

REM Check if dist directory exists
if not exist "%DIST_DIR%" (
    echo [ERROR] dist/ directory not found after build
    exit /b 1
)

echo [OK] Client built successfully
echo.

REM ==========================================
REM Step 3: Install Production Dependencies
REM ==========================================
echo [3/10] Installing production dependencies...

call npm install --production
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm install failed
    exit /b 1
)

echo [OK] Dependencies installed
echo.

REM ==========================================
REM Step 4: Generate Service Configuration
REM ==========================================
echo [4/10] Generating service configuration...

call npm run build:service
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Service configuration generation failed (non-fatal)
)

echo [OK] Service configuration generated
echo.

REM ==========================================
REM Step 5: Download Node.js Portable
REM ==========================================
echo [5/10] Downloading Node.js %NODEJS_VERSION% portable...

if exist "%NODEJS_DIR%" (
    echo [INFO] Node.js directory already exists, skipping download
) else (
    if not exist "%NODEJS_ARCHIVE%" (
        echo [INFO] Downloading from %NODEJS_URL%
        powershell -Command "& {Invoke-WebRequest -Uri '%NODEJS_URL%' -OutFile '%NODEJS_ARCHIVE%'}"
        if !ERRORLEVEL! NEQ 0 (
            echo [ERROR] Failed to download Node.js
            exit /b 1
        )
    ) else (
        echo [INFO] Using cached Node.js archive
    )

    echo [INFO] Extracting Node.js...
    powershell -Command "& {Expand-Archive -Path '%NODEJS_ARCHIVE%' -DestinationPath '%INSTALLER_DIR%' -Force}"
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] Failed to extract Node.js
        exit /b 1
    )

    REM Rename extracted folder to nodejs
    for /d %%i in ("%INSTALLER_DIR%node-v*-win-x64") do (
        move "%%i" "%NODEJS_DIR%"
    )
)

echo [OK] Node.js ready
echo.

REM ==========================================
REM Step 6: Generate Placeholder Images
REM ==========================================
echo [6/10] Generating placeholder images...

if not exist "%INSTALLER_DIR%banner.bmp" (
    echo [INFO] Creating banner.bmp...
    powershell -ExecutionPolicy Bypass -File "%INSTALLER_DIR%create-placeholder-images.ps1"
    if !ERRORLEVEL! NEQ 0 (
        echo [WARNING] Failed to create placeholder images (non-fatal)
        echo [WARNING] Using default WiX images
    )
) else (
    echo [INFO] Using existing images
)

echo [OK] Images ready
echo.

REM ==========================================
REM Step 7: Harvest Files with Heat.exe
REM ==========================================
echo [7/10] Harvesting files with Heat.exe...
cd /d "%INSTALLER_DIR%"

REM Harvest client dist files
echo [INFO] Harvesting client dist files...
"%WIX_BIN%\heat.exe" dir "%DIST_DIR%" -cg ClientFiles -dr DistDir -var var.DistPath -gg -scom -sreg -sfrag -srd -out ClientFiles.wxs
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to harvest client files
    exit /b 1
)

REM Harvest node_modules
echo [INFO] Harvesting node_modules...
"%WIX_BIN%\heat.exe" dir "%NODE_MODULES_DIR%" -cg NodeModules -dr AppDir -var var.NodeModulesPath -gg -scom -sreg -sfrag -srd -out NodeModules.wxs
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to harvest node_modules
    exit /b 1
)

REM Harvest Node.js runtime
echo [INFO] Harvesting Node.js runtime...
"%WIX_BIN%\heat.exe" dir "%NODEJS_DIR%" -cg NodeJsRuntime -dr NodeJsDir -var var.NodeJsPath -gg -scom -sreg -sfrag -srd -out NodeJsRuntime.wxs
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to harvest Node.js runtime
    exit /b 1
)

echo [OK] Files harvested successfully
echo.

REM ==========================================
REM Step 8: Compile WiX Sources (Candle)
REM ==========================================
echo [8/10] Compiling WiX sources...

"%WIX_BIN%\candle.exe" Product.wxs ConfigDialog.wxs ClientFiles.wxs NodeModules.wxs NodeJsRuntime.wxs ^
    -dDistPath="%DIST_DIR%" ^
    -dNodeModulesPath="%NODE_MODULES_DIR%" ^
    -dNodeJsPath="%NODEJS_DIR%" ^
    -dVersion="%VERSION%" ^
    -ext WixUtilExtension ^
    -ext WixUIExtension ^
    -arch x64 ^
    -out "%INSTALLER_DIR%"

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] WiX compilation failed
    exit /b 1
)

echo [OK] WiX sources compiled
echo.

REM ==========================================
REM Step 9: Link MSI (Light)
REM ==========================================
echo [9/10] Linking MSI...

"%WIX_BIN%\light.exe" Product.wixobj ConfigDialog.wixobj ClientFiles.wixobj NodeModules.wixobj NodeJsRuntime.wixobj ^
    -ext WixUtilExtension ^
    -ext WixUIExtension ^
    -cultures:en-US ^
    -loc en-US.wxl ^
    -out "KioskClient-v%VERSION%.msi"

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] MSI linking failed
    exit /b 1
)

echo [OK] MSI created successfully
echo.

REM ==========================================
REM Step 10: Cleanup
REM ==========================================
echo [10/10] Cleaning up intermediate files...

del /f /q *.wixobj 2>nul
del /f /q *.wixpdb 2>nul

echo [OK] Cleanup complete
echo.

REM ==========================================
REM Build Summary
REM ==========================================
echo ========================================
echo  BUILD SUCCESSFUL
echo ========================================
echo.
echo Output: KioskClient-v%VERSION%.msi
echo Location: %INSTALLER_DIR%
echo.
echo File size:
for %%A in ("KioskClient-v%VERSION%.msi") do echo   %%~zA bytes (%%~nA%%~xA)
echo.
echo Next steps:
echo   1. Test interactive install: KioskClient-v%VERSION%.msi
echo   2. Test silent install: msiexec /i KioskClient-v%VERSION%.msi /qn SERVER_URL=http://... DEVICE_TOKEN=...
echo   3. Test upgrade: Build new version and install over existing
echo   4. Upload to Intune for deployment
echo.

exit /b 0
