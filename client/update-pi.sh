#!/bin/bash

# Update script to run ON the Raspberry Pi
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/jimmyeao/PDS/<branch>/client/update-pi.sh | bash -s -- <install_dir> <branch>
# Defaults:
#   install_dir = $HOME/kiosk
#   branch = main

set -e

INSTALL_DIR=${1:-"$HOME/kiosk"}
BRANCH=${2:-"main"}

echo "🚀 Updating Kiosk Client on Raspberry Pi"
echo "Install directory: $INSTALL_DIR"
echo "Branch: $BRANCH"

if [ ! -d "$INSTALL_DIR" ]; then
  echo "❌ Install directory not found: $INSTALL_DIR"
  echo "Run setup first:"
  echo "  curl -fsSL https://raw.githubusercontent.com/jimmyeao/PDS/$BRANCH/client/setup-on-pi.sh | bash -s -- https://github.com/jimmyeao/PDS.git \"$INSTALL_DIR\""
  exit 1
fi

cd "$INSTALL_DIR"

echo "📦 Ensuring git repo is present..."
if [ ! -d .git ]; then
  echo "❌ Not a git repository. Please run setup again."
  exit 1
fi

echo "🔄 Fetching latest..."
git fetch --all --prune

echo "📥 Checking out branch: $BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "📦 Rebuilding shared package..."
cd shared
npm install --legacy-peer-deps
npm run build

echo "📦 Rebuilding client..."
cd ../client
npm install --legacy-peer-deps
npm run build

echo "✅ Update complete."
echo "Next steps:"
echo "  - If running manually: cd $INSTALL_DIR/client && npm start"
echo "  - If using systemd:   sudo systemctl restart kiosk-client && sudo journalctl -u kiosk-client -f"
