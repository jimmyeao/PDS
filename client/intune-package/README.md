# Kiosk Client - Intune Deployment Package

PowerShell-based installer for deploying Kiosk Digital Signage Client via Microsoft Intune.

## Package Contents

- **Install.ps1** - Installation script
- **Uninstall.ps1** - Removal script
- **Detection.ps1** - Intune detection rule
- **README.md** - This file

## Prerequisites

1. **Build the client first:**
   ```powershell
   cd C:\Users\Jimmy.White\source\VSCODE Projects\kiosk\client
   npm run build
   ```

2. **Download Microsoft Win32 Content Prep Tool:**
   - https://github.com/Microsoft/Microsoft-Win32-Content-Prep-Tool
   - Extract `IntuneWinAppUtil.exe`

## Option 1: Quick Test (Local Installation)

Test the installation on your local machine first:

```powershell
cd intune-package

# Run as Administrator
.\Install.ps1 -ServerUrl "http://192.168.0.57:5001" -DeviceToken "76DsItqcz0aW0IyZF3Ic0g"
```

**Verify:**
```powershell
# Check service status
sc query KioskClient

# Check logs
notepad "C:\Program Files\Kiosk Client\logs\service-out.log"

# Check configuration
notepad "C:\Program Files\Kiosk Client\app\.env"
```

**Uninstall:**
```powershell
.\Uninstall.ps1
```

## Option 2: Package for Intune Deployment

### Step 1: Prepare Source Folder

Create a deployment source folder with all required files:

```powershell
# Create source folder
$SourceFolder = "C:\KioskDeploy\Source"
New-Item -ItemType Directory -Path $SourceFolder -Force

# Copy installation scripts
Copy-Item "Install.ps1" -Destination $SourceFolder
Copy-Item "Uninstall.ps1" -Destination $SourceFolder

# Copy built client files (from parent directory)
$ClientPath = "C:\Users\Jimmy.White\source\VSCODE Projects\kiosk\client"
Copy-Item "$ClientPath\dist" -Destination "$SourceFolder\dist" -Recurse
Copy-Item "$ClientPath\package.json" -Destination $SourceFolder

# Copy node_modules from root (monorepo structure)
$RootNodeModules = "C:\Users\Jimmy.White\source\VSCODE Projects\kiosk\node_modules"
Copy-Item $RootNodeModules -Destination "$SourceFolder\node_modules" -Recurse
```

### Step 2: (Optional) Bundle Node.js

To avoid downloading Node.js during installation (recommended):

```powershell
# Download and extract Node.js
$NodeUrl = "https://nodejs.org/dist/v20.18.1/node-v20.18.1-win-x64.zip"
Invoke-WebRequest -Uri $NodeUrl -OutFile "C:\Temp\nodejs.zip"
Expand-Archive "C:\Temp\nodejs.zip" -DestinationPath "C:\Temp"

# Copy to source folder
Copy-Item "C:\Temp\node-v20.18.1-win-x64" -Destination "$SourceFolder\nodejs" -Recurse
```

### Step 3: Create .intunewin Package

```powershell
# Run IntuneWinAppUtil
cd C:\Tools  # Where you extracted IntuneWinAppUtil.exe

.\IntuneWinAppUtil.exe `
    -c "C:\KioskDeploy\Source" `
    -s "Install.ps1" `
    -o "C:\KioskDeploy\Output"
```

This creates: `C:\KioskDeploy\Output\Install.intunewin`

### Step 4: Upload to Intune

1. Sign in to **Microsoft Endpoint Manager** (https://endpoint.microsoft.com/)

2. Navigate to **Apps** > **Windows** > **Add**

3. Select **App type**: **Windows app (Win32)**

4. **App package file**: Upload `Install.intunewin`

5. **App information:**
   - Name: `Kiosk Digital Signage Client`
   - Description: `Digital signage client with remote management`
   - Publisher: `Your Company`
   - Category: `Productivity`

6. **Program:**
   - Install command:
     ```
     powershell.exe -ExecutionPolicy Bypass -File Install.ps1 -ServerUrl "http://192.168.0.57:5001" -DeviceToken "76DsItqcz0aW0IyZF3Ic0g"
     ```
   - Uninstall command:
     ```
     powershell.exe -ExecutionPolicy Bypass -File Uninstall.ps1
     ```
   - Install behavior: `System`
   - Device restart behavior: `No specific action`

7. **Requirements:**
   - Operating system architecture: `64-bit`
   - Minimum operating system: `Windows 10 1607`
   - Disk space required: `500 MB`
   - Physical memory required: `2048 MB`

8. **Detection rules:**
   - Rule type: `Use a custom detection script`
   - Script file: Upload `Detection.ps1`
   - Run script as 32-bit process: `No`
   - Enforce script signature check: `No`

9. **Dependencies**: None

10. **Assignments**: Assign to device groups

## Installation Details

### What Gets Installed

```
C:\Program Files\Kiosk Client\
├── app\
│   ├── dist\              # Built TypeScript files
│   ├── node_modules\      # Production dependencies
│   ├── package.json
│   └── .env               # Configuration (SERVER_URL, DEVICE_TOKEN)
├── nodejs\                # Node.js v20 runtime
├── logs\                  # Service logs
│   ├── service-out.log
│   └── service-error.log
└── nssm.exe               # Service manager
```

### Windows Service

- **Name**: `KioskClient`
- **Display Name**: Kiosk Digital Signage Client
- **Start Type**: Automatic
- **Restart on Failure**: Yes (after 60 seconds)
- **Account**: Local System

### Configuration Parameters

The install script accepts these parameters:

- **ServerUrl** (required): Backend server URL
- **DeviceToken** (required): Device authentication token
- **DisplayWidth** (optional, default: 1920)
- **DisplayHeight** (optional, default: 1080)
- **KioskMode** (optional, default: true)
- **LogLevel** (optional, default: info)

## Troubleshooting

### Check Installation Status

```powershell
# Service status
Get-Service KioskClient

# View logs
Get-Content "C:\Program Files\Kiosk Client\logs\service-out.log" -Tail 50

# Check configuration
Get-Content "C:\Program Files\Kiosk Client\app\.env"
```

### Common Issues

**Service won't start:**
- Check logs at `C:\Program Files\Kiosk Client\logs\`
- Verify .env configuration is correct
- Ensure server is reachable: `Test-NetConnection 192.168.0.57 -Port 5001`

**Installation fails:**
- Ensure running as Administrator
- Check Intune deployment logs in Event Viewer
- Verify client was built: `npm run build` in client directory

**Detection fails:**
- Run Detection.ps1 manually to see what's missing
- Verify `C:\Program Files\Kiosk Client\app\dist\index.js` exists

### Intune Deployment Logs

On target device:
```
C:\ProgramData\Microsoft\IntuneManagementExtension\Logs\IntuneManagementExtension.log
```

## Updating the Application

To deploy an update:

1. Build new version: `npm run build`
2. Update version number if desired
3. Create new .intunewin package following Step 3
4. Upload as new version or new app in Intune
5. Intune will stop service, update files, restart service

## Advantages Over MSI

✅ **Simpler** - Pure PowerShell, easy to understand and modify
✅ **Faster** - No WiX compilation, instant packaging
✅ **Debuggable** - Clear error messages, easy to troubleshoot
✅ **Flexible** - Easy to customize for different environments
✅ **Standard** - Common pattern for Intune Win32 apps
✅ **Smaller** - Only package what's needed

## Support

For issues or questions, check:
- Service logs: `C:\Program Files\Kiosk Client\logs\`
- Intune deployment logs (Event Viewer)
- Server connection: Verify device appears in admin dashboard
