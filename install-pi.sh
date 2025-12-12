#!/bin/bash
# Kiosk Client - Raspberry Pi Installation Script
# Usage: curl -sSL https://raw.githubusercontent.com/jimmyeao/PDS/main/install-pi.sh | bash

set -e  # Exit on error

echo "================================"
echo "Kiosk Client - Pi Installation"
echo "================================"
echo ""

# Check if running on Pi/Linux
if ! command -v apt-get &> /dev/null; then
    echo "❌ Error: This script is for Debian/Ubuntu/Raspberry Pi OS only"
    exit 1
fi

# Update system packages
echo "📦 Updating system packages..."
sudo apt-get update

# Install Node.js if not installed
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install Chromium if not installed
if ! command -v chromium-browser &> /dev/null && ! command -v chromium &> /dev/null; then
    echo "📦 Installing Chromium browser..."
    sudo apt-get install -y chromium-browser chromium-codecs-ffmpeg
fi

# Install git if not installed
if ! command -v git &> /dev/null; then
    echo "📦 Installing git..."
    sudo apt-get install -y git
fi

echo ""
echo "✅ Prerequisites installed"
echo ""

# Clone or update repository
INSTALL_DIR="$HOME/kiosk-client"
REPO_URL="${REPO_URL:-https://github.com/jimmyeao/PDS.git}"  # User can override with environment variable

if [ -d "$INSTALL_DIR/.git" ]; then
    echo "📥 Updating existing installation..."
    cd "$INSTALL_DIR"
    git pull
else
    echo "📥 Cloning repository..."
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# Install and build shared package
echo "📦 Building shared package..."
cd "$INSTALL_DIR/shared"
npm install --legacy-peer-deps
npm run build

# Install and build client
echo "📦 Building client..."
cd "$INSTALL_DIR/client"
npm install --legacy-peer-deps
npm run build

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating .env configuration file..."
    cp .env.example .env
    echo ""
    echo "⚠️  IMPORTANT: Edit $INSTALL_DIR/client/.env with your settings:"
    echo "   - SERVER_URL=http://your-server-ip:3000"
    echo "   - DEVICE_TOKEN=your-device-token"
    echo ""
    read -p "Press Enter to continue after editing .env, or Ctrl+C to exit and edit later..."
fi

# Return to root for remaining operations
cd "$INSTALL_DIR"

# Create update script
echo "📝 Creating update script..."
cat > "$INSTALL_DIR/update.sh" << 'UPDATEEOF'
#!/bin/bash
# Kiosk Client - Update Script

set -e
echo "🔄 Updating Kiosk Client..."

cd ~/kiosk-client

# Stop service if running
if systemctl is-active --quiet kiosk-client; then
    echo "⏸️  Stopping service..."
    sudo systemctl stop kiosk-client
fi

# Pull latest changes
echo "📥 Pulling latest code..."
git pull

# Build shared package
echo "📦 Building shared package..."
cd shared
npm install --legacy-peer-deps
npm run build

# Build client
echo "📦 Building client..."
cd ../client
npm install --legacy-peer-deps
npm run build

# Restart service
echo "▶️  Starting service..."
sudo systemctl start kiosk-client

echo "✅ Update complete!"
echo "📊 Checking status..."
sudo systemctl status kiosk-client --no-pager

echo ""
echo "📝 To view logs: sudo journalctl -u kiosk-client -f"
UPDATEEOF

chmod +x "$INSTALL_DIR/update.sh"

# Create systemd service
echo "📝 Creating systemd service..."
sudo tee /etc/systemd/system/kiosk-client.service > /dev/null << SERVICEEOF
[Unit]
Description=Kiosk Digital Signage Client
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR/client
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=DISPLAY=:0

[Install]
WantedBy=multi-user.target
SERVICEEOF

# Enable and start service
echo "▶️  Enabling and starting service..."
sudo systemctl daemon-reload
sudo systemctl enable kiosk-client
sudo systemctl start kiosk-client

echo ""
echo "================================"
echo "✅ Installation Complete!"
echo "================================"
echo ""
echo "📁 Installation directory: $INSTALL_DIR"
echo "🔄 Update command: $INSTALL_DIR/update.sh"
echo "📊 Service status: sudo systemctl status kiosk-client"
echo "📝 View logs: sudo journalctl -u kiosk-client -f"
echo ""
echo "🎯 Next steps:"
echo "1. Edit $INSTALL_DIR/client/.env with your server URL and device token"
echo "2. Restart: sudo systemctl restart kiosk-client"
echo "3. Check logs: sudo journalctl -u kiosk-client -f"
echo ""
