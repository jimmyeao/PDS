# TheiaCast - Professional Digital Signage Solution

![TheiaCast Logo](logo.png)

[![Version](https://img.shields.io/badge/version-1.0-blue.svg)](https://github.com/jimmyeao/TheiaCast/releases)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![.NET](https://img.shields.io/badge/.NET-8.0-purple.svg)](https://dotnet.microsoft.com/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://reactjs.org/)

A comprehensive web-based digital signage solution with centralized management, real-time monitoring, and advanced remote control capabilities. Perfect for managing displays across multiple locations with support for Windows PCs, Intel NUCs, and Raspberry Pi devices.

## ✨ Key Features

- 🖥️ **Central Management Dashboard** - Control all displays from one web interface
- 📺 **Live Device Monitoring** - Real-time view of what's displayed on each device
- 🎮 **Remote Control** - Interact with displays remotely (click, type, navigate)
- 📋 **Content Playlists** - Create and schedule content with rotation timers
- 💾 **Offline Caching** - Automatic content caching for seamless playback
- 🔒 **Security** - JWT authentication with 2FA support
- 📱 **Cross-Platform** - Windows and Raspberry Pi client support
- 🔄 **Real-time Updates** - WebSocket-based instant configuration changes

## 📸 Screenshots

### Device Management Dashboard

<img width="1201" height="900" alt="image" src="https://github.com/user-attachments/assets/0ae8aaf2-ffa2-47a1-a35a-d9151c699062" />


*Centralized view of all connected displays with live status monitoring*

### Device Control Actions
<img width="1201" height="899" alt="image" src="https://github.com/user-attachments/assets/7a2e20d7-d2ee-4238-8633-9343bc1bbcf7" />

*Quick access to device actions: screenshots, remote control, configuration*

### Content Library Management
<img width="1200" height="899" alt="image" src="https://github.com/user-attachments/assets/b9fc9a23-249e-4ec5-acaa-c040515828e9" />


*Organize and manage your digital signage assets*

### Playlist Management
<img width="1201" height="899" alt="image" src="https://github.com/user-attachments/assets/a709ab44-20b6-469d-a824-5e30ea6ee7d1" />

*Create and manage content playlists for different devices*

### Live Remote Control
<img width="1201" height="900" alt="image" src="https://github.com/user-attachments/assets/c0c14cd0-c1b2-48e6-9a59-cb0bedc93788" />

*Real-time remote control interface with smart home integration*

### Security & Settings
<img width="1201" height="898" alt="image" src="https://github.com/user-attachments/assets/29e2d09f-255d-4465-9a5c-7063a134c064" />

*Two-factor authentication and administrative controls*

## 🚀 Quick Start

### Option 1: Docker (Recommended)
Get up and running in minutes with Docker Compose:

```bash
# Clone the repository
git clone https://github.com/jimmyeao/TheiaCast.git
cd TheiaCast

# Start all services
docker-compose up -d
```

**Access your installation:**
- **Web Interface**: http://localhost:5173
- **API**: http://localhost:5001
- **Default Login**: admin / admin123 ⚠️ *Change immediately!*

### Option 2: Development Setup

```bash
# Install dependencies
npm install

# Start database
docker-compose up postgres -d

# Start backend (.NET 8)
cd src/PDS.Api
dotnet run

# Start frontend (React)
cd frontend
npm run dev
```

## 📱 Client Installation

### Raspberry Pi - One-Line Install
```bash
curl -sSL https://raw.githubusercontent.com/jimmyeao/TheiaCast/main/install-pi.sh | bash
```

### Windows - Installer Package
Download the latest installer from [Releases](https://github.com/jimmyeao/TheiaCast/releases) or:

```powershell
# Quick download
Invoke-WebRequest -Uri "https://github.com/jimmyeao/TheiaCast/releases/latest/download/TheiaCast-Setup.exe" -OutFile "TheiaCast-Setup.exe"

# Silent installation
.\TheiaCast-Setup.exe /VERYSILENT /ServerUrl=http://your-server:5001 /DeviceId=kiosk1 /DeviceToken=your-token
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   TheiaCast Digital Signage                 │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React 19 + TypeScript)                          │
│  ├── Device Management Dashboard                           │
│  ├── Content Library & Playlists                          │
│  ├── Live Monitoring & Remote Control                     │
│  └── Settings & Authentication                            │
├─────────────────────────────────────────────────────────────┤
│  Backend (ASP.NET Core 8 + PostgreSQL)                    │
│  ├── RESTful API + WebSocket                             │
│  ├── Device Authentication & Management                   │
│  ├── Content Storage & Streaming                         │
│  └── Real-time Communication                             │
├─────────────────────────────────────────────────────────────┤
│  Client Applications                                       │
│  ├── Raspberry Pi Client (Node.js + Puppeteer)          │
│  └── Windows Client (.NET 10 + Playwright)              │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Technology Stack

| Component | Technology |
|-----------|------------|
| **Backend** | ASP.NET Core 8 (C#) + PostgreSQL |
| **Frontend** | React 19 + TypeScript + Tailwind CSS |
| **Pi Client** | Node.js + Puppeteer + Chromium |
| **Windows Client** | .NET 10 + Playwright |
| **Communication** | WebSockets + REST API |
| **Authentication** | JWT + 2FA Support |

## 📁 Project Structure

```
TheiaCast/
├── 📁 src/
│   ├── 📁 TheiaCast.Api/        # ASP.NET Core 8 API server
│   └── 📁 TheiaCast.sln         # Visual Studio solution
├── 📁 frontend/                 # React admin dashboard
├── 📁 raspberrypi-client/       # Pi client (Node.js)
├── 📁 client-windows/           # Windows client (.NET)
├── 📁 shared/                   # TypeScript shared types
├── 📁 scripts/                  # Deployment scripts
├── 📁 deploy/                   # Docker configurations
└── 📄 docker-compose.yml        # Quick start setup
```

## ⚙️ Configuration

### Environment Variables

#### Server Configuration
```bash
# .env or docker-compose.yml
POSTGRES_PASSWORD=your-secure-password
JWT_SECRET=your-long-random-secret-minimum-32-chars
ASPNETCORE_URLS=http://localhost:5001
```

#### Raspberry Pi Client
```bash
# raspberrypi-client/.env
SERVER_URL=http://your-server:5001
DEVICE_ID=your-unique-device-id
DEVICE_TOKEN=token-from-admin-ui
DISPLAY_WIDTH=1920
DISPLAY_HEIGHT=1080
KIOSK_MODE=true
```

#### Windows Client
```json
// appsettings.json
{
  "ServerUrl": "http://your-server:5001",
  "DeviceId": "your-unique-device-id", 
  "DeviceToken": "token-from-admin-ui",
  "KioskMode": true
}
```

## 🌐 Production Deployment

### Server Deployment

#### Using Docker (Recommended)
```bash
# Clone and configure
git clone https://github.com/jimmyeao/TheiaCast.git
cd TheiaCast
cp .env.example .env
nano .env  # Update production settings

# Deploy
docker-compose -f docker-compose.prod.yml up -d
```

#### Manual Deployment
```bash
# Backend
cd src/TheiaCast.Api
dotnet publish -c Release -o publish
cd publish && dotnet TheiaCast.Api.dll

# Frontend 
cd frontend
npm run build
# Deploy dist/ to your web server
```

### Client Deployment

#### Raspberry Pi Mass Deployment
```bash
# On each Pi device
curl -sSL https://raw.githubusercontent.com/jimmyeao/TheiaCast/main/install-pi.sh | bash

# Configure device token
nano ~/pds-client/raspberrypi-client/.env
sudo systemctl restart pds-client
```

#### Windows Mass Deployment
```powershell
# Silent installation on multiple PCs
$devices = @("kiosk1", "kiosk2", "office1")
foreach($device in $devices) {
    .\TheiaCast-Setup.exe /VERYSILENT `
        /ServerUrl=http://your-server:5001 `
        /DeviceId=$device `
        /DeviceToken=(Get-TokenFromAPI $device)
}
```

## 📖 Advanced Features

### Remote Browser Control
- **Interactive Control**: Click, type, and navigate on remote displays
- **Authentication Handling**: Manage logins and MFA prompts remotely
- **Live Streaming**: Real-time view of device screens

### Smart Playlist Management
- **Scheduled Content**: Time-based content rotation
- **Global Broadcasting**: Emergency message override
- **Content Caching**: Automatic local storage for reliability

### Device Health Monitoring
- **System Metrics**: CPU, memory, disk usage tracking
- **Connection Status**: Real-time connectivity monitoring
- **Automated Alerts**: Notification system for device issues

## 📚 Documentation

- 📖 [Raspberry Pi Installation Guide](./README-PI-INSTALL.md)
- 🖥️ [Windows Client Documentation](./client-windows/README.md)
- 🎮 [Remote Control Features](./REMOTE-CONTROL.md)
- 🔧 [API Documentation](http://localhost:5001/swagger) (when running)

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

## 📄 License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)** - see the [LICENSE](LICENSE) file for details.

### What does AGPL v3 mean?

- ✅ **Free to use** for personal and non-commercial purposes
- ✅ **Modify and distribute** - you can change the code and share it
- ✅ **Open source** - all modifications must be open-sourced under AGPL v3
- ⚠️ **Network use = Distribution** - if you run a modified version as a service, you must share the source code
- 💼 **Commercial use** - contact us for commercial licensing options for businesses requiring >4 screens

For commercial licensing inquiries, please contact: [commercial@yourwebsite.com](mailto:commercial@yourwebsite.com)

## 🆘 Support & Troubleshooting

### Common Issues

**Client won't connect?**
```bash
# Check connectivity
curl http://your-server:5001/healthz

# Verify device token
# Check logs: sudo journalctl -u pds-client -f
```

**Chromium not found on Pi?**
```bash
sudo apt-get install chromium chromium-codecs-ffmpeg
```

**Need help?** Open an [issue](https://github.com/jimmyeao/TheiaCast/issues) with:
- System information
- Log files
- Steps to reproduce

---

<div align="center">

**⭐ Star this project if you find it useful!**

Made with ❤️ by [Jimmy White](https://github.com/jimmyeao)

[🐛 Report Bug](https://github.com/jimmyeao/TheiaCast/issues) • [✨ Request Feature](https://github.com/jimmyeao/TheiaCast/issues) • [📖 Documentation](https://github.com/jimmyeao/TheiaCast/wiki)

</div>
