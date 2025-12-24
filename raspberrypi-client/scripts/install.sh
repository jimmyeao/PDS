#!/bin/bash
#
# TheiaCast Client Installation Script
# This script installs the TheiaCast Kiosk Client on Linux/Raspberry Pi
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="/opt/theiacast-client"
SERVICE_NAME="theiacast-client"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}TheiaCast Client Installer${NC}"
echo -e "${GREEN}================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Error: This script must be run as root${NC}"
  echo "Please run: sudo $0"
  exit 1
fi

# Check for Node.js
if ! command -v node &> /dev/null; then
  echo -e "${YELLOW}Node.js not found. Installing Node.js 20.x...${NC}"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}✓${NC} Node.js ${NODE_VERSION} found"

# Stop existing service if running
if systemctl is-active --quiet ${SERVICE_NAME}; then
  echo "Stopping existing ${SERVICE_NAME} service..."
  systemctl stop ${SERVICE_NAME}
fi

# Create installation directory
echo "Creating installation directory at ${INSTALL_DIR}..."
mkdir -p ${INSTALL_DIR}

# Copy files to installation directory
echo "Copying files..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"

# Copy dist files
if [ -d "${PACKAGE_DIR}/dist" ]; then
  cp -r ${PACKAGE_DIR}/dist/* ${INSTALL_DIR}/
else
  echo -e "${RED}Error: dist directory not found at ${PACKAGE_DIR}/dist${NC}"
  exit 1
fi

# Copy package.json if it exists
if [ -f "${PACKAGE_DIR}/package.json" ]; then
  cp ${PACKAGE_DIR}/package.json ${INSTALL_DIR}/
fi

# Install dependencies
if [ -f "${INSTALL_DIR}/package.json" ]; then
  echo "Installing Node.js dependencies..."
  cd ${INSTALL_DIR}
  npm install --production --no-optional
fi

# Prompt for configuration
echo ""
echo -e "${YELLOW}Configuration:${NC}"
read -p "Enter Server URL (e.g., http://192.168.0.11:5001): " SERVER_URL
read -p "Enter Device ID (e.g., $(hostname)): " DEVICE_ID
DEVICE_ID=${DEVICE_ID:-$(hostname)}
read -p "Enter Device Token: " DEVICE_TOKEN

# Create .env file
cat > ${INSTALL_DIR}/.env << EOF
SERVER_URL=${SERVER_URL}
DEVICE_ID=${DEVICE_ID}
DEVICE_TOKEN=${DEVICE_TOKEN}
LOG_LEVEL=info
SCREENSHOT_INTERVAL=300000
HEALTH_REPORT_INTERVAL=60000
HEADLESS=false
KIOSK_MODE=false
EOF

echo -e "${GREEN}✓${NC} Configuration saved to ${INSTALL_DIR}/.env"

# Detect the actual user (not root)
ACTUAL_USER=${SUDO_USER:-$(who am i | awk '{print $1}')}
ACTUAL_USER=${ACTUAL_USER:-$(logname 2>/dev/null)}
USER_HOME=$(eval echo ~${ACTUAL_USER})

if [ -z "$ACTUAL_USER" ] || [ "$ACTUAL_USER" = "root" ]; then
  echo -e "${RED}Error: Cannot detect non-root user${NC}"
  echo "Please run as: sudo -u <username> $0"
  exit 1
fi

echo "Installing for user: $ACTUAL_USER"
echo "User home: $USER_HOME"

# Install Playwright browsers
echo "Installing Chromium browser..."
cd ${INSTALL_DIR}
# Install as the actual user to avoid permission issues
sudo -u ${ACTUAL_USER} npx playwright install chromium --with-deps

# Set proper ownership
chown -R ${ACTUAL_USER}:${ACTUAL_USER} ${INSTALL_DIR}

# Create systemd service
echo "Creating systemd service..."
cat > ${SERVICE_FILE} << EOF
[Unit]
Description=TheiaCast Kiosk Client
After=network.target graphical.target

[Service]
Type=simple
User=${ACTUAL_USER}
Group=${ACTUAL_USER}
WorkingDirectory=${INSTALL_DIR}
Environment="DISPLAY=:0"
Environment="XAUTHORITY=${USER_HOME}/.Xauthority"
Environment="HOME=${USER_HOME}"
EnvironmentFile=${INSTALL_DIR}/.env
ExecStart=/usr/bin/node ${INSTALL_DIR}/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Set permissions
chmod +x ${INSTALL_DIR}/index.js 2>/dev/null || true
chmod 644 ${SERVICE_FILE}

# Reload systemd
systemctl daemon-reload

# Enable and start service
echo "Enabling ${SERVICE_NAME} service..."
systemctl enable ${SERVICE_NAME}

echo "Starting ${SERVICE_NAME} service..."
systemctl start ${SERVICE_NAME}

# Check status
sleep 2
if systemctl is-active --quiet ${SERVICE_NAME}; then
  echo ""
  echo -e "${GREEN}================================${NC}"
  echo -e "${GREEN}Installation Complete!${NC}"
  echo -e "${GREEN}================================${NC}"
  echo ""
  echo "Service Status:"
  systemctl status ${SERVICE_NAME} --no-pager -l
  echo ""
  echo "Useful commands:"
  echo "  View logs:    sudo journalctl -u ${SERVICE_NAME} -f"
  echo "  Stop service: sudo systemctl stop ${SERVICE_NAME}"
  echo "  Start service: sudo systemctl start ${SERVICE_NAME}"
  echo "  Restart service: sudo systemctl restart ${SERVICE_NAME}"
  echo "  View status: sudo systemctl status ${SERVICE_NAME}"
  echo ""
else
  echo -e "${RED}Warning: Service failed to start${NC}"
  echo "Check logs with: sudo journalctl -u ${SERVICE_NAME} -n 50"
  exit 1
fi
