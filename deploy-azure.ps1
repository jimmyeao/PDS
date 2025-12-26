# TheiaCast Azure Deployment Script
# Deploys the Next.js website to Azure VM on port 443

$AzureHost = "40.81.144.252"
$AzureUser = "azurenoroot"
$KeyFile = ".\theiaweb_key.pem"
$LocalWebsiteSource = "\\192.168.0.11\theiacast-site"  # Or use SCP to copy from local server

Write-Host "=== TheiaCast Azure Deployment ===" -ForegroundColor Cyan

# Step 1: Check if key file exists
if (-not (Test-Path $KeyFile)) {
    Write-Host "ERROR: Key file not found at $KeyFile" -ForegroundColor Red
    Write-Host "Please copy thiaweb_key.pem to the project root directory" -ForegroundColor Yellow
    exit 1
}

# Step 2: Install Node.js on Azure VM
Write-Host "`n[1/8] Installing Node.js on Azure VM..." -ForegroundColor Green
ssh -i $KeyFile "$AzureUser@$AzureHost" @"
    # Install Node.js 20.x
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    node --version
    npm --version
"@

# Step 3: Install nginx
Write-Host "`n[2/8] Installing nginx..." -ForegroundColor Green
ssh -i $KeyFile "$AzureUser@$AzureHost" @"
    sudo apt-get update
    sudo apt-get install -y nginx
    sudo systemctl enable nginx
"@

# Step 4: Install Certbot for SSL
Write-Host "`n[3/8] Installing Certbot for SSL..." -ForegroundColor Green
ssh -i $KeyFile "$AzureUser@$AzureHost" @"
    sudo apt-get install -y certbot python3-certbot-nginx
"@

# Step 5: Copy website files from local server to Azure
Write-Host "`n[4/8] Copying website files to Azure VM..." -ForegroundColor Green
Write-Host "Copying from local server (192.168.0.11) to Azure..." -ForegroundColor Yellow

# Create archive on local server
ssh -i "C:\Users\jimmy\.ssh\id_ed25519" noroot@192.168.0.11 @"
    cd /home/noroot
    tar czf theiacast-site.tar.gz theiacast-site/
"@

# Copy archive to Windows machine
scp -i "C:\Users\jimmy\.ssh\id_ed25519" noroot@192.168.0.11:/home/noroot/theiacast-site.tar.gz .

# Copy archive to Azure VM
scp -i $KeyFile theiacast-site.tar.gz "$AzureUser@${AzureHost}:~/"

# Extract on Azure VM
ssh -i $KeyFile "$AzureUser@$AzureHost" @"
    tar xzf theiacast-site.tar.gz
    rm theiacast-site.tar.gz
"@

# Clean up local archive
Remove-Item theiacast-site.tar.gz -ErrorAction SilentlyContinue

# Step 6: Install dependencies and build
Write-Host "`n[5/8] Installing dependencies and building..." -ForegroundColor Green
ssh -i $KeyFile "$AzureUser@$AzureHost" @"
    cd ~/theiacast-site
    npm install
    npm run build
"@

# Step 7: Set up systemd service
Write-Host "`n[6/8] Setting up systemd service..." -ForegroundColor Green
ssh -i $KeyFile "$AzureUser@$AzureHost" @'
    sudo tee /etc/systemd/system/theiacast-web.service > /dev/null <<EOF
[Unit]
Description=TheiaCast Website
After=network.target

[Service]
Type=simple
User=azurenoroot
WorkingDirectory=/home/azurenoroot/theiacast-site
ExecStart=/usr/bin/npm start
Restart=always
Environment=PORT=3000
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable theiacast-web
    sudo systemctl start theiacast-web
    sudo systemctl status theiacast-web --no-pager
'@

# Step 8: Configure nginx reverse proxy
Write-Host "`n[7/8] Configuring nginx reverse proxy..." -ForegroundColor Green
ssh -i $KeyFile "$AzureUser@$AzureHost" @'
    sudo tee /etc/nginx/sites-available/theiacast > /dev/null <<EOF
server {
    listen 80;
    server_name 40.81.144.252;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

    sudo ln -sf /etc/nginx/sites-available/theiacast /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo nginx -t
    sudo systemctl restart nginx
'@

Write-Host "`n[8/8] Deployment complete!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Test the website: http://40.81.144.252" -ForegroundColor White
Write-Host "2. If you have a domain name, update DNS A record to point to 40.81.144.252" -ForegroundColor White
Write-Host "3. Run SSL setup (see deploy-azure-ssl.ps1)" -ForegroundColor White

Write-Host "`nUseful commands:" -ForegroundColor Yellow
Write-Host "  ssh -i $KeyFile $AzureUser@$AzureHost" -ForegroundColor White
Write-Host "  sudo systemctl status theiacast-web" -ForegroundColor White
Write-Host "  sudo systemctl restart theiacast-web" -ForegroundColor White
Write-Host "  sudo journalctl -u theiacast-web -f" -ForegroundColor White
Write-Host "  sudo nginx -t && sudo systemctl reload nginx" -ForegroundColor White
