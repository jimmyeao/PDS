@echo off
REM Test Installation Script for Kiosk Client MSI
REM Run this as Administrator

echo ========================================
echo  Kiosk Client - Test Installation
echo ========================================
echo.
echo Server: http://192.168.0.57:5001
echo Token: 76DsItqcz0aW0IyZF3Ic0g
echo.
echo Installing silently...
echo.

msiexec /i KioskClient-v1.0.0.0.msi /qn ^
  SERVER_URL=http://192.168.0.57:5001 ^
  DEVICE_TOKEN=76DsItqcz0aW0IyZF3Ic0g ^
  /l*v "%TEMP%\KioskClient-install.log"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo  Installation completed successfully!
    echo ========================================
    echo.
    echo Log file: %TEMP%\KioskClient-install.log
    echo.
    echo Checking service status...
    sc query KioskClient
    echo.
    echo Installation directory:
    dir "C:\Program Files\Kiosk Client"
    echo.
) else (
    echo.
    echo ========================================
    echo  Installation failed with error: %ERRORLEVEL%
    echo ========================================
    echo.
    echo Check log file: %TEMP%\KioskClient-install.log
    echo.
)

pause
