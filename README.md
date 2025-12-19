# PDS - Digital Signage Solution

A web-based digital signage solution with central management of display devices, featuring remote viewing capability, content scheduling, playlist control, and interactive page support. Supports Windows, Linux, and Raspberry Pi clients.

## Features

- **Central Management**: Web-based admin UI to manage all displays from one place
- **Remote Viewing**: See what's currently displayed on each device screen in real-time
- **Content Scheduling**: Create rotation schedules with display durations and time windows
- **Playlist Control**: Play/pause, next/previous navigation, and global broadcast capabilities
- **Offline Caching**: Automatically downloads and caches video content locally for seamless playback and reduced bandwidth
- **Large File Support**: Supports video uploads up to 2.5GB
- **Remote Browser Control**: Remotely interact with displayed pages (click, type, navigate)
- **Interactive Page Support**: Handle authentication and MFA prompts without interruption
- **Real-time Updates**: WebSocket-based communication for instant configuration changes
- **Health Monitoring**: Track device status, CPU, memory, temperature, and connection health
- **Cross-Platform Clients**: Supports Windows (Intel NUCs, PCs), Linux, and Raspberry Pi

## Architecture

- **Backend**: ASP.NET Core 8 (C#) with PostgreSQL database
- **Frontend**: React + Vite with TypeScript
- **Raspberry Pi Client**: Node.js + Puppeteer + Chromium (kiosk mode) for Raspberry Pi/Linux devices
- **Windows Client**: .NET 10 Service + Playwright + Chromium for Windows PCs
- **Real-time**: WebSocket communication for instant updates
- **Authentication**: JWT tokens

## Project Structure

```
PDS/
├── src/
│   ├── PDS.Api/         # ASP.NET Core 8 API server (.NET/C#)
│   └── PDS.sln          # Visual Studio solution file
├── frontend/            # React admin UI (Node.js workspace)
├── raspberrypi-client/  # Raspberry Pi display client (Node.js + Puppeteer)
├── client-windows/      # Windows display client (.NET service + Playwright)
├── shared/              # Shared TypeScript types (Node.js workspace)
├── scripts/             # Deployment and utility scripts
├── docker-compose.yml   # Docker deployment configuration
└── *.ps1                # PowerShell convenience scripts
```

**Note**: The project uses npm workspaces for frontend, raspberrypi-client, and shared packages. The backend and Windows client are separate .NET projects not managed by npm.

## Getting Started

### Prerequisites

- **Node.js** 18+ LTS
- **npm** 9+
- **.NET SDK** 8.0+ (for backend development)
- **PostgreSQL** 15+ (or use Docker)

### Quick Start with Docker (Recommended)

The easiest way to run the entire system:

```bash
# Clone the repository
git clone https://github.com/jimmyeao/PDS.git
cd PDS

# Configure environment (optional - has defaults)
cp .env.example .env
nano .env

# Start all services with Docker Compose
docker-compose up -d
```

Services will be available at:
- **Frontend UI**: http://localhost:5173
- **Backend API**: http://localhost:5001
- **PostgreSQL**: localhost:5432

Default admin credentials:
- Username: `admin`
- Password: `admin123`

**⚠️ Security Warning**: Change the default admin password immediately after first login, especially for production deployments!

### Development Setup

#### 1. Install Dependencies

```bash
# Install workspace dependencies
npm install
```

#### 2. Set Up Database

**Option A: Using Docker (Recommended)**
```bash
docker-compose up postgres -d
```

**Option B: Local PostgreSQL**
```bash
# Install PostgreSQL 15+
# Create database 'pds'
createdb pds
```

#### 3. Start Backend

The backend is an ASP.NET Core 8 application (not Node.js):

```bash
# Using PowerShell script (Windows)
.\start-backend-dotnet.ps1

# Or directly with dotnet CLI
cd src/PDS.Api
dotnet restore
dotnet run

# Or with specific configuration
dotnet run --configuration Development
```

Backend will be available at: http://localhost:5001
- Swagger UI: http://localhost:5001/swagger
- Health Check: http://localhost:5001/healthz
- WebSocket: ws://localhost:5001/ws

**Note**: The npm scripts `backend:dev`, `backend:build`, and `backend:start` in package.json are legacy references and do not work with the current .NET backend.

#### 4. Start Frontend

```bash
# Using npm script
npm run frontend:dev

# Or using PowerShell script (Windows)
.\start-frontend.ps1

# Or directly
cd frontend
npm run dev
```

Frontend will be available at: http://localhost:5173

#### 5. Build Client Application

```bash
npm run client:build
```

### Start Everything (Windows)

For Windows development, use the convenience script:

```powershell
.\start-everything.ps1
```

This starts backend, frontend, and a local test client in separate windows.

## Client Installation

The client application runs on display devices (Windows, Linux, or Raspberry Pi) to show content in kiosk mode.

### Raspberry Pi - Quick Setup (Recommended)

Run this one-liner on your Raspberry Pi:

```bash
curl -sSL https://raw.githubusercontent.com/jimmyeao/PDS/main/install-pi.sh | bash
```

This automated installer will:
- Install Node.js 20 LTS
- Install Chromium browser
- Clone the repository to `~/kiosk-client`
- Install all dependencies
- Create `.env` configuration file
- Set up systemd service for auto-start
- Create update script

📖 **For detailed Raspberry Pi instructions**, see [README-PI-INSTALL.md](README-PI-INSTALL.md)

### Windows - Installer

For Windows PCs or Intel NUCs, use the automated installer:

```powershell
# Build the installer (from project root)
cd client-windows
.\BuildInstaller.ps1
```

This creates `PDSKioskClient-Setup.exe` installer. Copy it to your Windows machine and:

**Interactive Installation:**
```powershell
PDSKioskClient-Setup.exe
```

**Silent Installation with Configuration:**
```powershell
PDSKioskClient-Setup.exe /VERYSILENT /ServerUrl=http://server:5001 /DeviceId=kiosk1 /DeviceToken=abc123
```

The installer will:
- Install the .NET service
- Install Playwright/Chromium browser
- Configure Windows Service to auto-start
- Set up application settings

📖 **For detailed Windows client instructions**, see [client-windows/README.md](client-windows/README.md)

### Linux - Manual Setup

1. **Install Node.js** (if not already installed):
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. **Install Chromium browser**:
   ```bash
   sudo apt-get install -y chromium-browser chromium-codecs-ffmpeg
   ```

3. **Clone the repository**:
   ```bash
   git clone https://github.com/jimmyeao/PDS.git ~/kiosk-client
   cd ~/kiosk-client
   ```

4. **Build the client**:
   ```bash
   # Build shared package first
   cd shared
   npm install
   npm run build
   cd ..

   # Build Raspberry Pi client
   cd raspberrypi-client
   npm install
   npm run build
   cd ..
   ```

5. **Configure the client**:
   ```bash
   cd raspberrypi-client
   cp .env.example .env
   nano .env
   ```

   Update the following variables in `.env`:
   ```env
   SERVER_URL=http://your-server-ip:5001
   DEVICE_ID=your-device-id          # Unique identifier for this device
   DEVICE_TOKEN=your-device-token    # Token from admin UI when creating device
   DISPLAY_WIDTH=1920
   DISPLAY_HEIGHT=1080
   KIOSK_MODE=true
   PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
   ```

6. **Start the client**:
   ```bash
   npm start
   # Or directly: node dist/index.js
   ```

### Getting Device Credentials

Before running the client, you need to register it in the admin UI:

1. Access the admin UI at `http://your-server-ip:5173` (or your deployed frontend URL)
2. Log in with admin credentials
3. Go to **Devices** page
4. Click **Add Device**
5. Fill in device details (name, location)
6. **Copy the device token** (shown only once!)
7. Use this token in your client's `.env` file as `DEVICE_TOKEN`

### Running as a Service (Production)

To run the client automatically on boot:

1. Create a systemd service:
   ```bash
   sudo nano /etc/systemd/system/kiosk-client.service
   ```

2. Add the following content:
   ```ini
   [Unit]
   Description=PDS Digital Signage Client
   After=network.target

   [Service]
   Type=simple
   User=pi
   WorkingDirectory=/home/pi/kiosk-client/raspberrypi-client
   ExecStart=/usr/bin/node dist/index.js
   Restart=always
   RestartSec=10
   Environment=NODE_ENV=production

   [Install]
   WantedBy=multi-user.target
   ```

3. Enable and start the service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable kiosk-client
   sudo systemctl start kiosk-client
   ```

4. Check status and view logs:
   ```bash
   sudo systemctl status kiosk-client
   sudo journalctl -u kiosk-client -f
   ```

**Note**: The automated Raspberry Pi installer (`install-pi.sh`) sets this up automatically.

### Updating the Client

To update to the latest version:

```bash
# If you used the automated installer, use the update script
~/kiosk-client/update.sh

# Or manually:
cd ~/kiosk-client
git pull

# Rebuild shared package
cd shared
npm install
npm run build
cd ..

# Rebuild Raspberry Pi client
cd raspberrypi-client
npm install
npm run build
cd ..

# Restart the service
sudo systemctl restart kiosk-client
```

### Troubleshooting

**Issue**: "Chrome is being controlled by automated test software" message appears
- **Solution**: This has been fixed in the latest version. Make sure you've pulled the latest code.

**Issue**: Client won't connect to backend
- Check `SERVER_URL` in `.env` is correct (should be `http://your-server-ip:5001`)
- Verify `DEVICE_TOKEN` is correct (from admin UI)
- Check firewall settings on backend server (port 5001)
- Test backend health: `curl http://your-server-ip:5001/healthz`
- Check client logs: `sudo journalctl -u kiosk-client -f`

**Issue**: Chromium not found
- Install Chromium: `sudo apt-get install chromium-browser chromium-codecs-ffmpeg`
- Update `PUPPETEER_EXECUTABLE_PATH` in `.env` to `/usr/bin/chromium-browser`

**Issue**: Client shows as offline after refresh
- This is normal behavior - reconnection happens automatically
- The latest version includes state synchronization

**Issue**: Display not showing on Raspberry Pi
- Set display environment: `export DISPLAY=:0`
- Add user to video group: `sudo usermod -a -G video $USER`

**Issue**: Permission denied errors
- Make sure the service user has correct permissions
- Check file ownership in the installation directory

## Advanced Features

### Playlist Control

The system supports real-time playlist control:
- **Play/Pause**: Pause content rotation on any device
- **Next/Previous**: Navigate through playlist items
- **Global Broadcast**: Override all displays with a temporary message
- **Time Constraints**: Schedule content for specific times and days

📖 See [PLAYLIST-CONTROL-PROGRESS.md](PLAYLIST-CONTROL-PROGRESS.md) for implementation details

### Remote Browser Control

Remotely interact with pages displayed on client devices:
- **Remote Click**: Click at specific coordinates
- **Remote Type**: Type text into form fields
- **Remote Key**: Press keyboard keys
- **Remote Scroll**: Scroll pages

📖 See [REMOTE-CONTROL.md](REMOTE-CONTROL.md) for usage guide

## API Documentation

When running the backend, access interactive API documentation:
- **Swagger UI**: http://localhost:5001/swagger

## Project Scripts

Available npm scripts in the root `package.json`:

```bash
# Frontend Development
npm run frontend:dev     # Start React frontend with Vite
npm run frontend:build   # Build frontend for production

# Client Development
npm run client:dev       # Run client in development mode
npm run client:build     # Build client application

# Utilities
npm run install:all      # Install all dependencies
npm run clean            # Clean node_modules from all workspaces
```

**Backend**: The backend is an ASP.NET Core 8 application and must be run using .NET CLI:
```bash
cd src/PDS.Api
dotnet restore
dotnet run
```

Windows PowerShell scripts:
- `start-everything.ps1` - Start backend, frontend, and test client
- `start-backend-dotnet.ps1` - Start only the backend (.NET)
- `start-frontend.ps1` - Start only the frontend
- `stop-all.ps1` - Stop all running services

**Note**: Legacy npm scripts `backend:dev`, `backend:build`, and `backend:start` are outdated and do not work with the current .NET backend.

## Environment Variables

### Backend (.env or docker-compose.yml)
```env
POSTGRES_PASSWORD=your-secure-password
JWT_SECRET=your-long-random-secret-string
ASPNETCORE_URLS=http://localhost:5001
ConnectionStrings__Default=Host=postgres;Port=5432;Database=pds;Username=postgres;Password=...
```

### Raspberry Pi Client (.env in raspberrypi-client directory)
```env
SERVER_URL=http://your-server-ip:5001
DEVICE_ID=your-device-id
DEVICE_TOKEN=your-device-token
DISPLAY_WIDTH=1920
DISPLAY_HEIGHT=1080
KIOSK_MODE=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser  # Linux/Pi path
HEALTH_REPORT_INTERVAL=60000
SCREENSHOT_INTERVAL=300000
LOG_LEVEL=info
```

### Windows Client (appsettings.json in client-windows)
Configured via installer parameters or `appsettings.json`:
```json
{
  "ServerUrl": "http://your-server-ip:5001",
  "DeviceId": "your-device-id",
  "DeviceToken": "your-device-token",
  "KioskMode": true,
  "DisplayWidth": 1920,
  "DisplayHeight": 1080
}
```

## Architecture Details

### Backend (ASP.NET Core 8)
- RESTful API with Swagger/OpenAPI documentation
- WebSocket support for real-time communication
- PostgreSQL database with Entity Framework Core
- JWT authentication
- Health checks and monitoring endpoints

### Frontend (React + Vite)
- Modern React with TypeScript
- Tailwind CSS for styling
- WebSocket integration for live updates
- Device management dashboard
- Playlist and schedule management
- Real-time device monitoring

### Raspberry Pi Client (Node.js + Puppeteer)
- Lightweight client for Raspberry Pi and Linux devices
- Headless Chromium browser control
- WebSocket client for server communication
- Automatic content rotation with scheduling
- Health monitoring and reporting
- Screenshot capture and upload
- Remote control capabilities

### Windows Client (.NET Service + Playwright)
- Windows service for PCs and Intel NUCs
- Playwright + Chromium browser automation
- Same WebSocket protocol and features as Pi client
- Windows Service auto-start capability
- Automated MSI installer with silent deployment

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT
