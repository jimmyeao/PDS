# TheiaCast Azure SSL Setup Script
# Sets up HTTPS for theiacast.com on port 443

$AzureHost = "40.81.144.252"
$AzureUser = "azurenoroot"
$KeyFile = ".\theiaweb_key.pem"
$Domain = "theiacast.com"

Write-Host "=== TheiaCast Azure SSL Setup for $Domain ===" -ForegroundColor Cyan

# Step 1: Update nginx config with domain name
Write-Host "`n[1/4] Updating nginx configuration for $Domain..." -ForegroundColor Green
ssh -i $KeyFile "$AzureUser@$AzureHost" @"
    sudo tee /etc/nginx/sites-available/theiacast > /dev/null <<'EOF'
server {
    listen 80;
    server_name theiacast.com www.theiacast.com 40.81.144.252;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \`$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \`$host;
        proxy_cache_bypass \`$http_upgrade;
        proxy_set_header X-Real-IP \`$remote_addr;
        proxy_set_header X-Forwarded-For \`$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \`$scheme;
    }
}
EOF

    sudo nginx -t && sudo systemctl reload nginx
"@

# Step 2: Install Certbot
Write-Host "`n[2/4] Installing Certbot..." -ForegroundColor Green
ssh -i $KeyFile "$AzureUser@$AzureHost" @"
    sudo apt-get update
    sudo apt-get install -y certbot python3-certbot-nginx
"@

# Step 3: Obtain SSL certificate
Write-Host "`n[3/4] Obtaining SSL certificate from Let's Encrypt..." -ForegroundColor Green
Write-Host "IMPORTANT: Make sure theiacast.com DNS A record points to $AzureHost" -ForegroundColor Yellow
Write-Host "Press Enter when DNS is configured, or Ctrl+C to cancel..." -ForegroundColor Yellow
Read-Host

ssh -i $KeyFile "$AzureUser@$AzureHost" @"
    sudo certbot --nginx -d theiacast.com -d www.theiacast.com --non-interactive --agree-tos --email admin@theiacast.com --redirect
"@

# Step 4: Verify and test
Write-Host "`n[4/4] Verifying installation..." -ForegroundColor Green
ssh -i $KeyFile "$AzureUser@$AzureHost" @"
    sudo systemctl status theiacast-web --no-pager | head -10
    echo '---'
    sudo systemctl status nginx --no-pager | head -10
    echo '---'
    sudo certbot certificates
"@

Write-Host "`n=== SSL Setup Complete! ===" -ForegroundColor Green
Write-Host "`nYour website is now accessible at:" -ForegroundColor Yellow
Write-Host "  https://theiacast.com" -ForegroundColor White
Write-Host "  https://www.theiacast.com" -ForegroundColor White
Write-Host ""
Write-Host "SSL certificate will auto-renew. Test renewal with:" -ForegroundColor Yellow
Write-Host "  sudo certbot renew --dry-run" -ForegroundColor White
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Yellow
Write-Host "  ssh -i $KeyFile $AzureUser@$AzureHost" -ForegroundColor White
Write-Host "  sudo systemctl status theiacast-web" -ForegroundColor White
Write-Host "  sudo systemctl restart theiacast-web" -ForegroundColor White
Write-Host "  sudo journalctl -u theiacast-web -f" -ForegroundColor White
Write-Host "  sudo nginx -t && sudo systemctl reload nginx" -ForegroundColor White
