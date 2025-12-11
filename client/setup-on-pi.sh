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

# Install dependencies for workspace
echo "📦 Installing dependencies..."
npm install --workspace=shared --workspace=client --legacy-peer-deps

# Build shared package
echo "🔧 Building shared package..."
cd shared
npm run build
cd ..

# Build client
echo "🔧 Building client..."
cd client
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
