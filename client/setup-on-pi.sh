#!/bin/bash

# Setup script to run ON the Raspberry Pi
# This will clone the repo and build everything needed

set -e

REPO_URL=${1:-"https://github.com/jimmyeao/PDS.git"}
INSTALL_DIR=${2:-"$HOME/kiosk"}

echo "🚀 Setting up Kiosk Client on Raspberry Pi"
echo "Repository: $REPO_URL"
echo "Install directory: $INSTALL_DIR"

# Install Node.js if not present
if ! command -v node &> /dev/null; then
  echo "📦 Installing Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# Clone repository
if [ -d "$INSTALL_DIR" ]; then
  echo "📂 Directory exists, pulling latest changes..."
  cd "$INSTALL_DIR"
  git pull
else
  echo "📥 Cloning repository..."
  git clone "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# Install and build shared package first
echo "📦 Installing shared package dependencies..."
cd shared
npm install --legacy-peer-deps
echo "🔧 Building shared package..."
npm run build
cd ..

# Install and build client (which will link to local shared package)
echo "📦 Installing client dependencies..."
cd client
npm install --legacy-peer-deps
echo "🔧 Building client..."
npm run build

# Create .env if it doesn't exist
if [ ! -f .env ]; then
  echo "📝 Creating .env file..."
  cp .env.example .env
  echo ""
  echo "⚠️  IMPORTANT: Edit the .env file with your configuration:"
  echo "   nano $INSTALL_DIR/client/.env"
  echo ""
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit configuration: nano $INSTALL_DIR/client/.env"
echo "2. Start the client: cd $INSTALL_DIR/client && npm start"
echo ""
echo "To update in the future:"
echo "  cd $INSTALL_DIR && git pull && npm run build"
