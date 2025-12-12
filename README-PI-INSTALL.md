# Raspberry Pi Quick Install

## One-Line Installation

```bash
curl -sSL https://raw.githubusercontent.com/jimmyeao/PDS/main/install-pi.sh | bash
```

Or with custom repository URL:
```bash
REPO_URL=https://github.com/jimmyeao/PDS.git curl -sSL https://raw.githubusercontent.com/jimmyeao/PDS/main/install-pi.sh | bash
```

## What the installer does:

1. ✅ Installs Node.js 20 LTS
2. ✅ Installs Chromium browser
3. ✅ Clones the repository to `~/kiosk-client`
4. ✅ Installs dependencies
5. ✅ Creates `.env` configuration file
6. ✅ Creates systemd service
7. ✅ Creates update script
8. ✅ Starts the client

## After Installation

### Configure the client:
```bash
nano ~/kiosk-client/.env
```

Set these values:
- `SERVER_URL=http://your-server-ip:3000`
- `DEVICE_TOKEN=your-device-token-from-admin-ui`

### Restart after configuration:
```bash
sudo systemctl restart kiosk-client
```

### View logs:
```bash
sudo journalctl -u kiosk-client -f
```

## Updating the Client

The installer creates an update script at `~/kiosk-client/update.sh`:

```bash
~/kiosk-client/update.sh
```

This will:
1. Stop the service
2. Pull latest code from git
3. Update dependencies
4. Restart the service

## Service Management

```bash
# Start the service
sudo systemctl start kiosk-client

# Stop the service
sudo systemctl stop kiosk-client

# Restart the service
sudo systemctl restart kiosk-client

# Check status
sudo systemctl status kiosk-client

# View logs
sudo journalctl -u kiosk-client -f

# Disable auto-start
sudo systemctl disable kiosk-client

# Enable auto-start
sudo systemctl enable kiosk-client
```

## Troubleshooting

### Display not showing
```bash
export DISPLAY=:0
```

### Permission issues
```bash
sudo usermod -a -G video $USER
```

### Chromium not found
```bash
sudo apt-get install chromium-browser chromium-codecs-ffmpeg
```

## Manual Installation

If you prefer to install manually, see [README.md](README.md) for detailed instructions.
