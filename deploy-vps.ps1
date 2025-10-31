# 🚀 One-Command VPS Deployment Script (PowerShell Version)
# Run this from your LOCAL machine to deploy to VPS

param(
    [Parameter(Mandatory=$true)]
    [string]$VpsIp,
    
    [Parameter(Mandatory=$false)]
    [string]$SshUser = "root"
)

Write-Host "🚀 Deploying Watch-With-Friends to VPS: $VpsIp" -ForegroundColor Green
Write-Host ""

# Test SSH connection
Write-Host "🔌 Testing SSH connection..." -ForegroundColor Yellow
try {
    ssh -o ConnectTimeout=5 "$SshUser@$VpsIp" "echo 'SSH connection successful'" 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "SSH connection failed"
    }
    Write-Host "✓ SSH connection successful" -ForegroundColor Green
} catch {
    Write-Host "✗ Cannot connect to VPS via SSH" -ForegroundColor Red
    Write-Host "Make sure:" -ForegroundColor Yellow
    Write-Host "  1. VPS IP is correct: $VpsIp" -ForegroundColor Yellow
    Write-Host "  2. SSH key is added to VPS" -ForegroundColor Yellow
    Write-Host "  3. Firewall allows SSH (port 22)" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Push latest code to GitHub
Write-Host "📤 Pushing latest code to GitHub..." -ForegroundColor Yellow
git add .
git commit -m "Deploy to VPS $(Get-Date -Format 'yyyy-MM-dd HH:mm')" -ErrorAction SilentlyContinue
git push origin main

Write-Host "✓ Code pushed to GitHub" -ForegroundColor Green
Write-Host ""

# Deploy to VPS
Write-Host "🚀 Deploying to VPS..." -ForegroundColor Yellow
Write-Host ""

ssh "$SshUser@$VpsIp" @"
set -e

# Clone/update repository
if [ -d "watchtogtr" ]; then
    echo "📥 Updating repository..."
    cd watchtogtr
    git pull origin main
else
    echo "📥 Cloning repository..."
    git clone https://github.com/erishhhhh00/watchtogtr.git
    cd watchtogtr
fi

# Run deployment script
chmod +x deploy-vps.sh
./deploy-vps.sh
"@

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host "🎉 DEPLOYMENT SUCCESSFUL! 🎉" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host ""
    Write-Host "📱 Your app is now live at:" -ForegroundColor Cyan
    Write-Host "http://$VpsIp:5173" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "🌍 Share this link with friends!" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "✗ Deployment failed. Check logs above." -ForegroundColor Red
    exit 1
}
