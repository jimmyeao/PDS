# PDS - Digital Signage Solution

A web-based digital signage solution with central management of display devices, featuring remote viewing capability, content scheduling, playlist control, and interactive page support. Supports Windows and Raspberry Pi clients.

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
- **Health Monitoring**: Track device status, CPU, memory, disk usage, and connection health
- **Cross-Platform Clients**: Supports Windows (Intel NUCs, PCs) and Raspberry Pi (Linux)

## Architecture

- **Backend**: ASP.NET Core 8 (C#) with PostgreSQL database
- **Frontend**: React 19 + Vite with TypeScript
- **Raspberry Pi Client**: Node.js + Puppeteer + Chromium for Raspberry Pi OS/Debian Linux
- **Windows Client**: .NET 10 Service + Playwright + Chromium for Windows 10/11
- **Real-time**: Native WebSocket communication for instant updates
- **Authentication**: JWT tokens (admin) + persistent device tokens

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

This starts backend and frontend in separate windows.

**Note**: Client applications (Windows or Raspberry Pi) should be started separately as services or standalone processes.

## Deployment

This section covers production deployment of the PDS system.

### Backend + Frontend Deployment

#### Option 1: Docker Deployment (Recommended)

The easiest way to deploy the backend and frontend together:

```bash
# Clone the repository
git clone https://github.com/jimmyeao/PDS.git
cd PDS

# Configure environment variables
cp .env.example .env
nano .env  # Update with your production settings

# Start services
docker-compose up -d
```

Services will be available at:
- **Frontend**: http://your-server-ip:5173
- **Backend API**: http://your-server-ip:5001
- **PostgreSQL**: localhost:5432

**Important**: Update the following in your `.env` file:
- `POSTGRES_PASSWORD` - Set a secure database password
- `JWT_SECRET` - Set a long random secret (minimum 32 characters)
- Change default admin password after first login

#### Option 2: Manual Deployment

**Backend (.NET)**:

1. **Build the backend**:
   ```bash
   cd src/PDS.Api
   dotnet publish -c Release -o publish
   ```

2. **Set up PostgreSQL database**:
   ```bash
   # Create database
   createdb pds
   ```

3. **Configure appsettings.json**:
   ```json
   {
     "ConnectionStrings": {
       "Default": "Host=localhost;Port=5432;Database=pds;Username=postgres;Password=your-password"
     },
     "Jwt": {
       "Secret": "your-long-random-secret-minimum-32-characters",
       "Issuer": "pds",
       "Audience": "pds-clients"
     }
   }
   ```

4. **Run the backend**:
   ```bash
   cd publish
   dotnet PDS.Api.dll
   ```

   Or set up as a systemd service on Linux:
   ```bash
   sudo nano /etc/systemd/system/pds-api.service
   ```

   ```ini
   [Unit]
   Description=PDS Digital Signage API
   After=network.target postgresql.service

   [Service]
   Type=notify
   WorkingDirectory=/opt/pds/api
   ExecStart=/usr/bin/dotnet /opt/pds/api/PDS.Api.dll
   Restart=always
   RestartSec=10
   User=pds
   Environment=ASPNETCORE_ENVIRONMENT=Production
   Environment=ASPNETCORE_URLS=http://0.0.0.0:5001

   [Install]
   WantedBy=multi-user.target
   ```

**Frontend (React)**:

1. **Build the frontend**:
   ```bash
   cd frontend
   npm install
   npm run build
   ```

2. **Deploy the build** to a web server:

   **Using Nginx**:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       root /var/www/pds/frontend;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }

       # Proxy API requests to backend
       location /api/ {
           proxy_pass http://localhost:5001/;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }

       # WebSocket support
       location /ws {
           proxy_pass http://localhost:5001/ws;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "Upgrade";
           proxy_set_header Host $host;
       }
   }
   ```

3. **Copy build files**:
   ```bash
   sudo mkdir -p /var/www/pds
   sudo cp -r dist/* /var/www/pds/frontend/
   sudo chown -R www-data:www-data /var/www/pds
   ```

4. **Update frontend configuration**:

   Create `frontend/.env.production`:
   ```env
   VITE_API_URL=http://your-server-ip:5001
   ```

   Then rebuild: `npm run build`

### Raspberry Pi Client Deployment

Use the automated one-line installer on each Raspberry Pi device:

```bash
curl -sSL https://raw.githubusercontent.com/jimmyeao/PDS/main/install-pi.sh | bash
```

This will:
- Install all dependencies (Node.js, Chromium)
- Clone the repository to `~/pds-client`
- Build the client application
- Create systemd service for auto-start
- Generate update script

**After installation**:
1. Edit configuration: `nano ~/pds-client/raspberrypi-client/.env`
2. Set `SERVER_URL`, `DEVICE_TOKEN` (from admin UI)
3. Restart service: `sudo systemctl restart pds-client`

**To update**: Run `~/pds-client/update-pi.sh`

📖 **Detailed instructions**: [README-PI-INSTALL.md](README-PI-INSTALL.md)

### Windows Client Deployment

Download the latest installer from GitHub releases and deploy to Windows devices:

**Quick Download**:
```powershell
# Download latest release
Invoke-WebRequest -Uri "https://github.com/jimmyeao/PDS/releases/latest/download/PDSKioskClient-Setup.exe" -OutFile "PDSKioskClient-Setup.exe"
```

**Interactive Installation**:
```powershell
.\PDSKioskClient-Setup.exe
```

**Silent Installation** (for mass deployment):
```powershell
.\PDSKioskClient-Setup.exe /VERYSILENT /ServerUrl=http://your-server-ip:5001 /DeviceId=kiosk1 /DeviceToken=your-token-here
```

**Installation Parameters**:
- `/VERYSILENT` - No UI, fully automated
- `/ServerUrl=` - Backend API URL
- `/DeviceId=` - Unique device identifier
- `/DeviceToken=` - Device authentication token (from admin UI)
- `/DIR="C:\CustomPath"` - Custom installation directory (optional)

The installer will:
- Install .NET runtime if needed
- Install Playwright + Chromium browser
- Create Windows Service (auto-start on boot)
- Configure application settings

**Post-Installation**:
- Service starts automatically
- Check status: `Get-Service PDSKioskClient`
- View logs: Event Viewer → Windows Logs → Application

**To update**: Download and run the latest installer - it will upgrade in place.

📖 **Detailed instructions**: [client-windows/README.md](client-windows/README.md)

### Getting Device Tokens

Before deploying clients, register each device in the admin UI:

1. Access admin UI: `http://your-server-ip:5173`
2. Login with admin credentials
3. Navigate to **Devices** page
4. Click **Add Device**
5. Enter device name and details
6. **Copy the device token** (shown only once!)
7. Use this token when configuring the client

## Client Installation

The client application runs on display devices (Windows or Raspberry Pi) to show content in kiosk mode.

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

For Windows PCs or Intel NUCs, download the latest installer from GitHub releases:

**Download Latest Release:**
```powershell
# Download from GitHub releases (recommended)
Invoke-WebRequest -Uri "https://github.com/jimmyeao/PDS/releases/latest/download/PDSKioskClient-Setup.exe" -OutFile "PDSKioskClient-Setup.exe"
```

Or manually download from: https://github.com/jimmyeao/PDS/releases/latest

**Interactive Installation:**
```powershell
.\PDSKioskClient-Setup.exe
```

**Silent Installation with Configuration:**
```powershell
.\PDSKioskClient-Setup.exe /VERYSILENT /ServerUrl=http://server:5001 /DeviceId=kiosk1 /DeviceToken=abc123
```

The installer will:
- Install the .NET service
- Install Playwright/Chromium browser
- Configure Windows Service to auto-start
- Set up application settings

**Building from source** (optional):
```powershell
cd client-windows
.\BuildInstaller.ps1
```

📖 **For detailed Windows client instructions**, see [client-windows/README.md](client-windows/README.md)

### Raspberry Pi - Manual Setup (Alternative)

If you prefer manual installation instead of using the automated installer:

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
   git clone https://github.com/jimmyeao/PDS.git ~/pds-client
   cd ~/pds-client
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
   PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
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
   sudo nano /etc/systemd/system/pds-client.service
   ```

2. Add the following content:
   ```ini
   [Unit]
   Description=PDS Digital Signage Client
   After=network.target

   [Service]
   Type=simple
   User=pi
   WorkingDirectory=/home/pi/pds-client/raspberrypi-client
   ExecStart=/usr/bin/node dist/index.js
   Restart=always
   RestartSec=10
   Environment=NODE_ENV=production
   Environment=DISPLAY=:0
   # Ensure all child processes (Chromium) are killed when service stops
   KillMode=control-group
   KillSignal=SIGTERM
   TimeoutStopSec=10

   [Install]
   WantedBy=multi-user.target
   ```

3. Enable and start the service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable pds-client
   sudo systemctl start pds-client
   ```

4. Check status and view logs:
   ```bash
   sudo systemctl status pds-client
   sudo journalctl -u pds-client -f
   ```

**Note**: The automated Raspberry Pi installer (`install-pi.sh`) sets this up automatically.

### Updating the Client

To update to the latest version:

```bash
# If you used the automated installer, use the update script
~/pds-client/update-pi.sh

# Or manually:
cd ~/pds-client
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
sudo systemctl restart pds-client
```

### Troubleshooting

**Issue**: "Chrome is being controlled by automated test software" message appears
- **Solution**: This has been fixed in the latest version. Make sure you've pulled the latest code.

**Issue**: Client won't connect to backend
- Check `SERVER_URL` in `.env` is correct (should be `http://your-server-ip:5001`)
- Verify `DEVICE_TOKEN` is correct (from admin UI)
- Check firewall settings on backend server (port 5001)
- Test backend health: `curl http://your-server-ip:5001/healthz`
- Check client logs: `sudo journalctl -u pds-client -f`

**Issue**: Chromium not found
- Modern Raspberry Pi OS: `sudo apt-get install chromium chromium-codecs-ffmpeg`
- Update `PUPPETEER_EXECUTABLE_PATH` in `.env` to `/usr/bin/chromium`
- Older systems: Use `/usr/bin/chromium-browser` instead

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
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium  # Modern Raspberry Pi OS
# PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser  # Older systems
HEALTH_CHECK_INTERVAL=60000
SCREENSHOT_INTERVAL=30000
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

### Frontend (React 19 + Vite)
- React 19 with TypeScript
- Tailwind CSS for styling
- Zustand for state management
- Native WebSocket integration for live updates
- Device management dashboard with flip card UI
- Playlist and content management
- Real-time device monitoring with live streaming
- Remote browser control interface

### Raspberry Pi Client (Node.js + Puppeteer)
- Lightweight client for Raspberry Pi OS (Debian-based Linux)
- Puppeteer + Chromium browser automation
- Native WebSocket client for server communication
- Automatic content rotation with playlist execution
- Health monitoring and reporting (CPU, memory, disk)
- Periodic screenshot capture and upload (30-second intervals)
- Remote control capabilities (click, type, keyboard, scroll)
- Chrome DevTools Protocol (CDP) screencast for live streaming
- Persistent browser profile for session retention

### Windows Client (.NET 10 Service + Playwright)
- Windows service for Windows 10/11 PCs and Intel NUCs
- Playwright + Chromium browser automation
- Same WebSocket protocol and features as Pi client
- Windows Service auto-start capability
- Inno Setup installer (.exe) with silent deployment support
- Periodic screenshot capture (30-second intervals)
- Health monitoring (CPU, memory, disk)
- CDP screencast for live streaming
- Remote control capabilities

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT
