#!/bin/bash

# Deployment script for Kiosk Client
# Usage: ./deploy-client.sh pi@<ip-address> [destination-path]

set -e

PI_HOST=$1
DEST_PATH=${2:-"/home/noroot/kiosk-client"}

if [ -z "$PI_HOST" ]; then
  echo "Usage: ./deploy-client.sh pi@<ip-address> [destination-path]"
  exit 1
fi

echo "🔧 Building client and dependencies..."

# Build shared package
cd shared
npm run build
cd ..

# Build client
cd client
npm run build
cd ..

echo "📦 Creating deployment package..."

# Create temporary deployment directory
DEPLOY_DIR=$(mktemp -d)
echo "Using temp directory: $DEPLOY_DIR"

# Copy client files
mkdir -p "$DEPLOY_DIR/client"
cp -r client/dist "$DEPLOY_DIR/client/"
cp client/package.json "$DEPLOY_DIR/client/"
cp client/.env.example "$DEPLOY_DIR/client/"

# Copy shared package (built)
mkdir -p "$DEPLOY_DIR/shared"
cp -r shared/dist "$DEPLOY_DIR/shared/"
cp shared/package.json "$DEPLOY_DIR/shared/"

# Create a package.json that uses local shared package
cat > "$DEPLOY_DIR/client/package.json" << 'EOF'
{
  "name": "@kiosk/client",
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@kiosk/shared": "file:../shared",
    "puppeteer": "^23.11.1",
    "socket.io-client": "^4.8.1",
    "dotenv": "^16.4.7",
    "systeminformation": "^5.23.5"
  }
}
EOF

echo "📤 Deploying to $PI_HOST:$DEST_PATH..."

# Create destination directory on Pi
ssh "$PI_HOST" "mkdir -p $DEST_PATH"

# Copy files to Pi
rsync -av --delete "$DEPLOY_DIR/" "$PI_HOST:$DEST_PATH/"

# Install dependencies on Pi
echo "📦 Installing dependencies on Pi..."
ssh "$PI_HOST" "cd $DEST_PATH/client && npm install --production"

# Cleanup
rm -rf "$DEPLOY_DIR"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next steps on the Pi:"
echo "1. cd $DEST_PATH/client"
echo "2. cp .env.example .env"
echo "3. Edit .env with your configuration"
echo "4. npm start"
