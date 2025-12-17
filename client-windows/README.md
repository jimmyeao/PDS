# Kiosk Client - Windows (.NET C#)

**Alternative Windows implementation** using .NET C# and Playwright instead of Node.js.

## ✨ Why This Version?

- **10x Simpler Installation**: Single `.exe` file, no Node.js, no npm install
- **Native Windows Service**: Built-in Windows service support, no NSSM needed
- **Smaller Package**: ~15-20 MB vs 300+ MB for Node.js version
- **Better Integration**: Native Windows APIs for health monitoring
- **Lower Resources**: Less memory, faster startup

## 📦 Architecture

```
client-windows/
├── KioskClient.Core/         # Core library (Playwright, WebSocket, Health)
└── KioskClient.Service/      # Windows Service executable
```

## 🚀 Quick Start

### 1. Install Playwright Browsers (One-Time)

```powershell
cd KioskClient.Service\bin\Release\net10.0
pwsh bin/Debug/playwright.ps1 install chromium
```

### 2. Configure

Edit `appsettings.json`:

```json
{
  "Kiosk": {
    "ServerUrl": "http://localhost:5001",
    "DeviceId": "YOUR-DEVICE-ID",
    "DeviceToken": "YOUR-DEVICE-TOKEN",
    "Headless": false,
    "ViewportWidth": 1920,
    "ViewportHeight": 1080
  }
}
```

### 3. Run

**As Console App (Testing)**:
```powershell
dotnet run --project KioskClient.Service
```

**As Windows Service**:
```powershell
# Publish self-contained
dotnet publish KioskClient.Service -c Release -r win-x64 --self-contained

# Install service
sc.exe create KioskClient binPath="C:\path\to\KioskClient.Service.exe" start=auto
sc.exe start KioskClient
```

## ✅ Features Implemented

- ✅ WebSocket client (matches Node.js protocol)
- ✅ Browser automation (Playwright)
- ✅ Health monitoring (native Windows APIs)
- ✅ Screenshot capture
- ✅ Remote control (click, type, keyboard, scroll)
- ✅ Navigate, refresh commands
- ⏳ Playlist execution (TODO)
- ⏳ Live streaming (CDP screencast) (TODO)
- ⏳ Auto-authentication (TODO)

## 🆚 vs Node.js Client

| Feature | Node.js Client | .NET Client |
|---------|---------------|-------------|
| **Runtime** | Node.js 20+ | Self-contained .exe |
| **Package Size** | 300+ MB | ~15-20 MB |
| **Installation** | npm install (complex) | Copy files (simple) |
| **Service Manager** | NSSM (external) | Native Windows Service |
| **Health Monitor** | systeminformation | Native WMI/PerfCounters |
| **Browser** | Puppeteer + Chromium | Playwright + Chromium |
| **Platform** | Cross-platform | **Windows only** |

## 📝 Next Steps

1. Test basic functionality
2. Implement playlist execution
3. Add live streaming support
4. Create installer (MSI or PowerShell)
5. Deploy to test machine

## 🔧 Development

```powershell
# Build
dotnet build

# Run
dotnet run --project KioskClient.Service

# Publish
dotnet publish -c Release -r win-x64 --self-contained
```

## 📖 Notes

- **Keep Node.js version**: This is for Windows only, Node.js version still needed for Raspberry Pi
- **Both versions supported**: Can deploy either version
- **Same backend**: Both connect to the same .NET backend server

