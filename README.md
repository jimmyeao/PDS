# Kiosk Digital Signage Solution

A web-based digital signage solution with central management of Raspberry Pi displays, featuring remote viewing capability, content scheduling, and interactive page support.

## Features

- **Central Management**: Web-based admin UI to manage all displays from one place
- **Remote Viewing**: See what's currently displayed on each Raspberry Pi screen in real-time
- **Content Scheduling**: Create rotation schedules with display durations and time windows
- **Interactive Page Support**: Handle authentication and MFA prompts without interruption
- **Real-time Updates**: WebSocket-based communication for instant configuration changes
- **Health Monitoring**: Track device status, CPU, memory, and connection health

## Architecture

- **Backend**: NestJS (Node.js + TypeScript) with SQLite database
- **Frontend**: React + Vite with TypeScript
- **Client**: Node.js + Puppeteer + Chromium (kiosk mode) for Raspberry Pi
- **Real-time**: Socket.IO for WebSocket communication
- **Authentication**: JWT tokens

## Project Structure

```
kiosk/
├── backend/      # NestJS API server
├── frontend/     # React admin UI
├── client/       # Raspberry Pi client application
└── shared/       # Shared TypeScript types
```

## Getting Started

### Prerequisites

- Node.js 18+ LTS
- npm 9+

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Development

Start the backend server:
```bash
npm run backend:dev
```

Start the frontend development server:
```bash
npm run frontend:dev
```

Build the client application:
```bash
npm run client:build
```

## Client Installation (Raspberry Pi)

The client application runs on Raspberry Pi devices to display content in kiosk mode.

### Quick Setup (Recommended)

Run this one-liner on your Raspberry Pi:

```bash
curl -fsSL https://raw.githubusercontent.com/jimmyeao/PDS/main/client/setup-on-pi.sh | bash
```

This will:
- Install Node.js if needed
- Clone the repository
- Build all dependencies
- Set up the client application

### Manual Setup

1. **Install Node.js** (if not already installed):
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. **Clone the repository**:
   ```bash
   git clone https://github.com/jimmyeao/PDS.git ~/kiosk
   cd ~/kiosk
   ```

3. **Install and build**:
   ```bash
   npm install --workspace=shared --workspace=client --legacy-peer-deps
   npm run build --workspace=shared
   npm run build --workspace=client
   ```

4. **Configure the client**:
   ```bash
   cd client
   cp .env.example .env
   nano .env
   ```

   Update the following variables in `.env`:
   ```env
   DEVICE_ID=your-device-id          # Unique identifier for this device
   DEVICE_TOKEN=your-device-token    # Token from admin UI when creating device
   BACKEND_URL=http://your-backend-ip:3000
   KIOSK_MODE=true
   DISPLAY_WIDTH=1920
   DISPLAY_HEIGHT=1080
   PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser  # Or path to Chrome/Chromium
   ```

5. **Start the client**:
   ```bash
   npm start
   ```

### Getting Device Credentials

Before running the client, you need to register it in the admin UI:

1. Access the admin UI at `http://your-backend-ip:3000`
2. Go to **Devices** page
3. Click **Add Device**
4. Fill in device details (ID, name, location)
5. **Copy the device token** (shown only once!)
6. Use this token in your client's `.env` file

### Running as a Service (Production)

To run the client automatically on boot:

1. Create a systemd service:
   ```bash
   sudo nano /etc/systemd/system/kiosk-client.service
   ```

2. Add the following content:
   ```ini
   [Unit]
   Description=Kiosk Digital Signage Client
   After=network.target

   [Service]
   Type=simple
   User=pi
   WorkingDirectory=/home/pi/kiosk/client
   ExecStart=/usr/bin/npm start
   Restart=always
   RestartSec=10

   [Install]
   WantedBy=multi-user.target
   ```

3. Enable and start the service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable kiosk-client
   sudo systemctl start kiosk-client
   ```

4. Check status:
   ```bash
   sudo systemctl status kiosk-client
   ```

### Updating the Client

To update to the latest version:

```bash
cd ~/kiosk
git pull
npm install --workspace=shared --workspace=client --legacy-peer-deps
npm run build --workspace=shared
npm run build --workspace=client
sudo systemctl restart kiosk-client  # If running as service
```

### Troubleshooting

**Issue**: "Chrome is being controlled by automated test software" message appears
- **Solution**: This has been fixed in the latest version. Make sure you've pulled the latest code.

**Issue**: Client won't connect to backend
- Check `BACKEND_URL` in `.env` is correct
- Verify `DEVICE_TOKEN` is correct (from admin UI)
- Check firewall settings on backend server
- Check backend logs: `cd ~/kiosk/backend && npm run logs`

**Issue**: Chromium not found
- Install Chromium: `sudo apt-get install chromium-browser`
- Update `PUPPETEER_EXECUTABLE_PATH` in `.env`

**Issue**: Client shows as offline after refresh
- This is normal behavior - reconnection happens automatically
- The latest version includes state synchronization

## Documentation

See the [implementation plan](https://github.com/anthropics/claude-code/plans/mutable-knitting-dove.md) for detailed architecture and development phases.

## License

MIT
