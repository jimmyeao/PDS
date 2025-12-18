# Intune Win32 App Deployment Guide

## Overview

This guide explains how to package and deploy the PDS Kiosk Client as an Intune Win32 app for remote installation on Windows devices.

## Prerequisites

1. **Built Installer**: Run `BuildInstaller.ps1` to create `PDSKioskClient-Setup.exe`
2. **Microsoft Win32 Content Prep Tool**: Download from [GitHub](https://github.com/microsoft/Microsoft-Win32-Content-Prep-Tool/releases)
3. **Server Configuration**:
   - Server URL (e.g., `http://192.168.0.57:5001`)
   - Device Token (obtain from admin UI)

## Step 1: Package the Installer

Download the Microsoft Win32 Content Prep Tool:
```powershell
# Download IntuneWinAppUtil.exe to the client-windows folder
Invoke-WebRequest -Uri "https://github.com/microsoft/Microsoft-Win32-Content-Prep-Tool/releases/latest/download/IntuneWinAppUtil.exe" -OutFile ".\IntuneWinAppUtil.exe"
```

Run the packaging script:
```powershell
.\PackageForIntune.ps1 -ServerUrl "http://your-server:5001" -DeviceToken "your-device-token"
```

This creates:
- `IntuneOutput\PDSKioskClient-Setup.intunewin` - Package file for upload
- `IntuneOutput\DeploymentInfo.txt` - Configuration details

## Step 2: Upload to Intune

1. Open **Microsoft Endpoint Manager admin center** (https://endpoint.microsoft.com)
2. Navigate to: **Apps** > **Windows** > **Add**
3. Select **Windows app (Win32)**
4. Click **Select** and upload `PDSKioskClient-Setup.intunewin`

## Step 3: Configure App Information

### Basic Information
- **Name**: PDS Kiosk Client
- **Description**: Digital signage client with remote management and live streaming
- **Publisher**: PDS
- **Category**: Business

### Program Configuration

**Install Command:**
```
PDSKioskClient-Setup.exe /VERYSILENT /ServerUrl=http://your-server:5001 /DeviceId=%COMPUTERNAME% /DeviceToken=your-device-token
```

**Uninstall Command:**
```
"C:\Program Files (x86)\PDS\KioskClient\uninstallexe" /VERYSILENT
```

**Install Behavior**: System
**Device Restart Behavior**: Determine behavior based on return codes

### Requirements

- **Operating System**: Windows 10 1607 or later (64-bit)
- **Architecture**: x64
- **Minimum Disk Space**: 500 MB
- **Minimum Memory**: 2 GB

### Detection Rules

**Rule Type**: File

| Setting | Value |
|---------|-------|
| Path | `C:\Program Files (x86)\PDS\KioskClient` |
| File or folder | `KioskClient.Service.exe` |
| Detection method | File or folder exists |
| Associated with a 32-bit app | Yes |

### Return Codes

Use default return codes:
- 0 = Success
- 1707 = Success
- 3010 = Soft reboot
- 1641 = Hard reboot
- 1618 = Retry

## Step 4: Assign to Devices

1. Click **Assignments**
2. Add groups:
   - **Required**: Assign to device groups that must have the kiosk
   - **Available**: Make available for manual install
3. Click **Review + Save**

## Step 5: Monitor Deployment

1. Go to **Apps** > **Windows** > **PDS Kiosk Client**
2. Click **Device install status**
3. Monitor installation progress

## Deployment Behavior

### What Happens on Installation

1. Installer runs silently with elevated privileges
2. Files copied to `C:\Program Files (x86)\PDS\KioskClient`
3. Browser profile created at `C:\ProgramData\PDS\browser-profile`
4. Playwright browsers bundled in installation (no download needed)
5. `PLAYWRIGHT_BROWSERS_PATH` environment variable set
6. Scheduled Task created for auto-start on user login
7. Configuration file created at `C:\Program Files (x86)\PDS\KioskClient\appsettings.json`
8. Task starts immediately (browser should appear)

### Auto-Start Configuration

The installer creates a Scheduled Task named `PDSKioskClient-AutoStart` that:
- Runs on user login (ONLOGON trigger)
- Runs with highest privileges
- Runs in the interactive user session (UI visible)
- Detects the actual logged-in user (not the elevated installer account)
- Allows task to be visible on demand (not hidden)

### Device Configuration

The installer automatically configures:
```json
{
  "Kiosk": {
    "ServerUrl": "http://your-server:5001",
    "DeviceId": "COMPUTERNAME",
    "DeviceToken": "your-token",
    "HealthReportIntervalMs": 60000,
    "ScreenshotIntervalMs": 300000,
    "Headless": false,
    "KioskMode": false,
    "ViewportWidth": 1920,
    "ViewportHeight": 1080
  }
}
```

## Troubleshooting

### Installation Fails

1. Check **Event Viewer** > **Application** logs for errors
2. Review installation log: `C:\Windows\Temp\PDSKioskClient-Setup.log`
3. Verify disk space and permissions

### Browser Not Visible

1. Verify Scheduled Task exists:
   ```powershell
   Get-ScheduledTask -TaskName "PDSKioskClient-AutoStart"
   ```

2. Check task is running:
   ```powershell
   Get-ScheduledTask -TaskName "PDSKioskClient-AutoStart" | Get-ScheduledTaskInfo
   ```

3. Manually run task:
   ```powershell
   Start-ScheduledTask -TaskName "PDSKioskClient-AutoStart"
   ```

### Connection Issues

1. Check configuration:
   ```powershell
   Get-Content "C:\Program Files (x86)\PDS\KioskClient\appsettings.json"
   ```

2. Verify server is reachable:
   ```powershell
   Test-NetConnection -ComputerName your-server -Port 5001
   ```

3. Check application logs:
   ```powershell
   Get-EventLog -LogName Application -Source "PDS.Kiosk.Client" -Newest 20
   ```

### Profile Errors

If you see "Profile error occurred" popup:
1. Delete browser profile:
   ```powershell
   Remove-Item "C:\ProgramData\PDS\browser-profile" -Recurse -Force
   ```

2. Restart the task:
   ```powershell
   Stop-ScheduledTask -TaskName "PDSKioskClient-AutoStart"
   Start-ScheduledTask -TaskName "PDSKioskClient-AutoStart"
   ```

## Uninstallation

Intune will automatically uninstall using the configured command, which:
1. Stops and removes the Scheduled Task
2. Stops and removes any old Windows Service (from previous versions)
3. Removes browser profile directory
4. Removes environment variable
5. Deletes all files from `C:\Program Files (x86)\PDS\KioskClient`

Manual uninstall:
```powershell
& "C:\Program Files (x86)\PDS\KioskClient\uninstallexe" /VERYSILENT
```

## Updating the App

To update to a new version:
1. Build new installer with updated version number
2. Package with Win32 Content Prep Tool
3. In Intune, edit the existing app
4. Upload new .intunewin package
5. Intune will automatically update deployed devices

## Command Line Options

The installer supports these parameters:

| Parameter | Description | Example |
|-----------|-------------|---------|
| /VERYSILENT | Silent installation (no UI) | Required for Intune |
| /ServerUrl | PDS server URL | `http://192.168.0.57:5001` |
| /DeviceId | Unique device identifier | `%COMPUTERNAME%` or custom |
| /DeviceToken | Authentication token | From admin UI |

## Security Considerations

1. **Device Token**: Keep token secure; it provides full device access
2. **HTTPS**: Use HTTPS for production deployments (not HTTP)
3. **Network Access**: Ensure devices can reach server on configured port
4. **Privileges**: Installer requires admin/SYSTEM privileges
5. **User Context**: App runs in user session, not SYSTEM session

## Best Practices

1. **Test First**: Deploy to a pilot group before wide deployment
2. **Token Management**: Use device-specific tokens, not shared tokens
3. **Monitoring**: Regularly check device status in admin UI
4. **Updates**: Keep installer version updated with server version
5. **Logging**: Monitor Event Viewer and application logs for issues

## Support

For issues or questions:
1. Check Event Viewer Application logs
2. Review `C:\Program Files (x86)\PDS\KioskClient\logs`
3. Test connectivity to server
4. Verify token and DeviceId in appsettings.json
