#!/bin/bash
# Kiosk Client - Update Script for Raspberry Pi
# This script is created during installation and can be run to update the client

set -e

echo "================================"
echo "🔄 Updating Kiosk Client"
echo "================================"
echo ""

cd ~/kiosk-client || { echo "❌ Installation directory not found"; exit 1; }

# Stop service if running
if systemctl is-active --quiet kiosk-client 2>/dev/null; then
    echo "⏸️  Stopping kiosk-client service..."
    sudo systemctl stop kiosk-client
    RESTART_SERVICE=true
else
    echo "ℹ️  Service not running"
    RESTART_SERVICE=false
fi

# Pull latest changes
echo "📥 Pulling latest code from git..."
git pull

# Update dependencies
echo "📦 Updating dependencies..."
npm install --production --legacy-peer-deps

# Restart service if it was running
if [ "$RESTART_SERVICE" = true ]; then
    echo "▶️  Starting kiosk-client service..."
    sudo systemctl start kiosk-client

    echo ""
    echo "✅ Update complete!"
    echo ""
    echo "📊 Service status:"
    sudo systemctl status kiosk-client --no-pager -l

    echo ""
    echo "📝 To view live logs: sudo journalctl -u kiosk-client -f"
else
    echo ""
    echo "✅ Update complete!"
    echo ""
    echo "▶️  Start the service with: sudo systemctl start kiosk-client"
fi

echo ""
