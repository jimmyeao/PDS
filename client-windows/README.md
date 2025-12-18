# PDS Kiosk Client - Windows .NET

Windows service client for PDS (Playlist Display System) built with .NET 10 and Playwright.

## ✨ Why This Version?

- **Native Windows Service**: Built-in Windows service support, no NSSM needed
- **Simpler Installation**: Automated PowerShell installer with command-line configuration
- **Better Integration**: Native Windows APIs for health monitoring
- **Lower Resources**: Less memory, faster startup
- **Full Feature Parity**: All features from Node.js client now implemented

## Requirements

- Windows 10/11 or Windows Server 2019+
- .NET 8.0 SDK or later
- Administrator privileges
- PowerShell 5.1 or later

## Quick Install

### Option 1: Setup.exe Installer (Recommended)

#### 1. Download or Build Installer

**Download:** Get `PDSKioskClient-Setup.exe` from releases

**Or Build It Yourself:**
```powershell
# Install Inno Setup from https://jrsoftware.org/isdl.php
# Then run:
cd path\to\client-windows
.\BuildInstaller.ps1
```

#### 2. Obtain Device Token

Before installing, get a device token from the PDS admin interface:
1. Log into PDS admin UI (e.g., http://your-server:5173)
2. Go to **Devices** page
3. Create or select your device
4. Copy the **Device Token**

#### 3. Run Installer

**Interactive Installation (GUI):**
```powershell
PDSKioskClient-Setup.exe
```
The installer will prompt for Server URL, Device ID, and Token.

**Silent Installation (for scripting/remote deployment):**
```powershell
PDSKioskClient-Setup.exe /VERYSILENT /ServerUrl=http://192.168.0.57:5001 /DeviceId=office-kiosk /DeviceToken=abc123
```

### Option 2: PowerShell Installer Script

```powershell
cd path\to\client-windows
.\Install.ps1 -ServerUrl "http://192.168.0.57:5001" -DeviceId "lobby-display" -DeviceToken "abc123"
```

## Remote Deployment

### Using Setup.exe (Recommended)

```powershell
# Copy installer to remote machine
Copy-Item PDSKioskClient-Setup.exe \\REMOTE-PC\C$\Temp\

# Execute silent installation remotely
Invoke-Command -ComputerName REMOTE-PC -ScriptBlock {
    C:\Temp\PDSKioskClient-Setup.exe /VERYSILENT /ServerUrl=http://192.168.0.57:5001 /DeviceId=remote-kiosk /DeviceToken=abc123
}
```

### Using PowerShell Script

```powershell
# Copy source to remote machine
Copy-Item -Path ".\client-windows" -Destination "\\REMOTE-PC\C$\Temp\" -Recurse

# Execute installer remotely
Invoke-Command -ComputerName REMOTE-PC -ScriptBlock {
    Set-Location "C:\Temp\client-windows"
    .\Install.ps1 -ServerUrl "http://192.168.0.57:5001" -DeviceId "remote-kiosk" -DeviceToken "token-here"
}
```

## Service Management

### Check Service Status

```powershell
Get-Service -Name PDSKioskClient
```

### Start/Stop Service

```powershell
Stop-Service -Name PDSKioskClient
Start-Service -Name PDSKioskClient
Restart-Service -Name PDSKioskClient
```

### View Logs

```powershell
Get-EventLog -LogName Application -Source KioskClient -Newest 50
```

## Uninstall

```powershell
# Remove service only
.\Uninstall.ps1

# Remove service and files
.\Uninstall.ps1 -RemoveFiles
```

## ✅ Features (Complete Feature Parity)

- ✅ Windows Service with auto-start
- ✅ Real-time WebSocket communication
- ✅ Playlist execution with content rotation
- ✅ Auto-authentication for protected sites
- ✅ Remote browser control (click, type, keyboard, scroll)
- ✅ Live CDP screencast streaming
- ✅ Health monitoring (CPU, memory, disk)
- ✅ Automatic screenshot capture
- ✅ Dynamic display configuration updates
- ✅ Persistent browser profile (retains sessions/cookies)
- ✅ WebAuthn/passkey popup blocking
- ✅ Kiosk mode support (fullscreen)
- ✅ Play/pause/next/previous playlist controls
- ✅ Config updates (resolution, kiosk mode) without restart

## Configuration

Configuration is stored in `C:\Program Files\PDS\KioskClient\appsettings.json`:

```json
{
  "Kiosk": {
    "ServerUrl": "http://192.168.0.57:5001",
    "DeviceId": "office-kiosk",
    "DeviceToken": "your-token-here",
    "HealthReportIntervalMs": 60000,
    "ScreenshotIntervalMs": 300000,
    "Headless": false,
    "KioskMode": false,
    "ViewportWidth": 1920,
    "ViewportHeight": 1080
  }
}
```

After editing configuration, restart the service:

```powershell
Restart-Service -Name PDSKioskClient
```

## 🆚 vs Node.js Client

| Feature | Node.js Client | .NET Client |
|---------|---------------|-------------|
| **Runtime** | Node.js 20+ | Self-contained .exe |
| **Installation** | npm install | PowerShell installer |
| **Service Manager** | PM2/systemd | Native Windows Service |
| **Health Monitor** | systeminformation | Native WMI/PerfCounters |
| **Browser** | Puppeteer + Chromium | Playwright + Chromium |
| **Platform** | Cross-platform | **Windows only** |
| **Features** | ✅ All | ✅ All (Full Parity) |

## 📦 Architecture

```
client-windows/
├── Install.ps1               # Automated installer
├── Uninstall.ps1             # Uninstaller
├── KioskClient.Core/         # Core library (Playwright, WebSocket, Health)
└── KioskClient.Service/      # Windows Service executable
```

## 🔧 Development

```powershell
# Build
dotnet build

# Run (console mode for testing)
dotnet run --project KioskClient.Service

# Publish
dotnet publish KioskClient.Service -c Release
```

## Troubleshooting

See the full README for troubleshooting steps including:
- Service won't start
- Browser issues
- Network issues
- Log viewing

## 📖 Notes

- **Keep Node.js version**: This is for Windows only, Node.js version still needed for Raspberry Pi
- **Both versions supported**: Can deploy either version to Windows
- **Same backend**: Both connect to the same .NET backend server

