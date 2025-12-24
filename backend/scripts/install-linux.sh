#!/bin/bash
#
# TheiaCast Backend Installation Script for Linux
#

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

INSTALL_DIR="/opt/theiacast-backend"
SERVICE_NAME="theiacast-backend"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}TheiaCast Backend Installer${NC}"
echo -e "${GREEN}================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Error: This script must be run as root${NC}"
  echo "Please run: sudo $0"
  exit 1
fi

# Stop existing service if running
if systemctl is-active --quiet ${SERVICE_NAME}; then
  echo "Stopping existing ${SERVICE_NAME} service..."
  systemctl stop ${SERVICE_NAME}
fi

# Create installation directory
echo "Creating installation directory at ${INSTALL_DIR}..."
mkdir -p ${INSTALL_DIR}

# Copy files
echo "Copying files..."
cp -r * ${INSTALL_DIR}/

# Prompt for configuration
echo ""
echo -e "${YELLOW}Database Configuration:${NC}"
read -p "Enter PostgreSQL Host (default: localhost): " DB_HOST
DB_HOST=${DB_HOST:-localhost}
read -p "Enter PostgreSQL Port (default: 5432): " DB_PORT
DB_PORT=${DB_PORT:-5432}
read -p "Enter PostgreSQL Database Name (default: theiacast): " DB_NAME
DB_NAME=${DB_NAME:-theiacast}
read -p "Enter PostgreSQL Username: " DB_USER
read -sp "Enter PostgreSQL Password: " DB_PASS
echo ""

echo ""
echo -e "${YELLOW}JWT Configuration:${NC}"
read -p "Enter JWT Secret (min 32 characters, press Enter to generate): " JWT_SECRET
if [ -z "$JWT_SECRET" ]; then
  JWT_SECRET=$(openssl rand -base64 48)
  echo "Generated JWT Secret: $JWT_SECRET"
fi

# Create appsettings.json
cat > ${INSTALL_DIR}/appsettings.json << EOF
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "ConnectionStrings": {
    "Default": "Host=${DB_HOST};Port=${DB_PORT};Database=${DB_NAME};Username=${DB_USER};Password=${DB_PASS}"
  },
  "Jwt": {
    "Secret": "${JWT_SECRET}",
    "Issuer": "theiacast",
    "Audience": "theiacast-clients"
  }
}
EOF

echo -e "${GREEN}✓${NC} Configuration saved to ${INSTALL_DIR}/appsettings.json"

# Create dedicated user for the service
if ! id -u theiacast &>/dev/null; then
  echo "Creating theiacast service user..."
  useradd -r -s /bin/false -d ${INSTALL_DIR} -c "TheiaCast Backend Service" theiacast
fi

# Set permissions
chmod +x ${INSTALL_DIR}/TheiaCast.Backend 2>/dev/null || chmod +x ${INSTALL_DIR}/backend 2>/dev/null || true
chmod 600 ${INSTALL_DIR}/appsettings.json
chown -R theiacast:theiacast ${INSTALL_DIR}

# Create systemd service
echo "Creating systemd service..."
BACKEND_EXE=$(find ${INSTALL_DIR} -maxdepth 1 -type f -executable -name "*.Backend" -o -name "backend" | head -1)

cat > ${SERVICE_FILE} << EOF
[Unit]
Description=TheiaCast Backend Server
After=network.target postgresql.service

[Service]
Type=notify
User=theiacast
Group=theiacast
WorkingDirectory=${INSTALL_DIR}
ExecStart=${BACKEND_EXE}
Restart=always
RestartSec=10
Environment="ASPNETCORE_ENVIRONMENT=Production"
Environment="ASPNETCORE_URLS=http://0.0.0.0:5001"

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${INSTALL_DIR}

[Install]
WantedBy=multi-user.target
EOF

chmod 644 ${SERVICE_FILE}

# Reload systemd
systemctl daemon-reload

# Enable service
echo "Enabling ${SERVICE_NAME} service..."
systemctl enable ${SERVICE_NAME}

# Run database migrations (if applicable)
echo "Running database migrations..."
cd ${INSTALL_DIR}
${BACKEND_EXE} || echo "Note: Manual database setup may be required"

# Start service
echo "Starting ${SERVICE_NAME} service..."
systemctl start ${SERVICE_NAME}

# Check status
sleep 3
if systemctl is-active --quiet ${SERVICE_NAME}; then
  echo ""
  echo -e "${GREEN}================================${NC}"
  echo -e "${GREEN}Installation Complete!${NC}"
  echo -e "${GREEN}================================${NC}"
  echo ""
  echo "Backend is running at: http://localhost:5001"
  echo "Swagger UI: http://localhost:5001/swagger"
  echo ""
  echo "Useful commands:"
  echo "  View logs:    sudo journalctl -u ${SERVICE_NAME} -f"
  echo "  Stop service: sudo systemctl stop ${SERVICE_NAME}"
  echo "  Start service: sudo systemctl start ${SERVICE_NAME}"
  echo "  Restart service: sudo systemctl restart ${SERVICE_NAME}"
  echo ""
else
  echo -e "${RED}Warning: Service failed to start${NC}"
  echo "Check logs with: sudo journalctl -u ${SERVICE_NAME} -n 50"
  exit 1
fi
