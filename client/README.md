# Kiosk Digital Signage Client

Raspberry Pi client application for the Kiosk Digital Signage system.

## Features

- **WebSocket Communication**: Real-time connection to backend server
- **Content Scheduling**: Automatic content rotation based on schedules
- **Health Monitoring**: CPU, memory, and temperature reporting
- **Screenshot Capture**: Periodic and on-demand screenshots
- **Kiosk Mode**: Fullscreen display using Chromium
- **Remote Control**: Restart, refresh, and navigate commands from admin UI

## Installation

### On Development Machine (Windows/Mac/Linux)

```bash
cd client
npm install
```

### On Raspberry Pi

1. Install Node.js (v18 or higher):
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

2. Install Chromium dependencies:
```bash
sudo apt-get install -y chromium-browser chromium-codecs-ffmpeg
```

3. Install client:
```bash
cd client
npm install
npm run build
```

## Configuration

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` with your settings:
```env
SERVER_URL=http://your-server:3000
DEVICE_ID=rpi-001
DEVICE_TOKEN=your-jwt-token-here
DISPLAY_WIDTH=1920
DISPLAY_HEIGHT=1080
KIOSK_MODE=true
```

### Getting a Device Token

1. Log into the admin UI
2. Create a new device in the Devices page
3. The backend will generate credentials for the device
4. Use the JWT token in your `.env` file

## Usage

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm run build
npm start
```

### Running as a Service (Raspberry Pi)

Create a systemd service file `/etc/systemd/system/kiosk-client.service`:

```ini
[Unit]
Description=Kiosk Digital Signage Client
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/kiosk/client
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl enable kiosk-client
sudo systemctl start kiosk-client
sudo systemctl status kiosk-client
```

View logs:
```bash
sudo journalctl -u kiosk-client -f
```

## Architecture

```
src/
├── index.ts        - Main entry point, orchestrates all modules
├── config.ts       - Configuration management
├── logger.ts       - Logging utility
├── websocket.ts    - WebSocket client for server communication
├── display.ts      - Puppeteer display controller
├── scheduler.ts    - Schedule execution engine
├── health.ts       - System health monitoring
└── screenshot.ts   - Screenshot capture and upload
```

## Troubleshooting

### Display Issues on Raspberry Pi

If you encounter display issues:
```bash
export DISPLAY=:0
```

### Chromium Not Found

Install Chromium manually:
```bash
sudo apt-get install chromium-browser
```

### Permission Issues

Run with proper permissions or add user to video group:
```bash
sudo usermod -a -G video pi
```

## Development

Run TypeScript compiler in watch mode:
```bash
npm run watch
```

## License

MIT
