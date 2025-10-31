#!/usr/bin/env bash
set -euo pipefail

# Quick setup script for Ubuntu/Debian VPS (no domain). Run from repo root.

if [ "${EUID}" -ne 0 ]; then
  echo "[i] Not root: some steps will use sudo"
fi

echo "[1/8] Updating system packages"
sudo apt-get update -y
sudo apt-get upgrade -y

echo "[2/8] Installing prerequisites"
sudo apt-get install -y curl software-properties-common build-essential ffmpeg redis-server

echo "[3/8] Installing Node.js 20 (NodeSource)"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

node -v
npm -v

echo "[4/8] Enabling Redis service"
sudo systemctl enable redis-server
sudo systemctl start redis-server
sudo systemctl status redis-server --no-pager || true

echo "[5/8] Installing PM2"
sudo npm install -g pm2
pm2 -v

# Optional: open firewall ports (uncomment if UFW is enabled)
# sudo ufw allow 3001/tcp   # backend API
# sudo ufw allow 5173/tcp   # vite dev (if used)

echo "[6/8] Building backend"
cd backend
npm ci
npm run build

# Create logs dir if not exists
mkdir -p logs

# Create a default .env file if not present
if [ ! -f .env ]; then
  cat > .env <<EOF
NODE_ENV=production
PORT=3001
# Comma-separated list of allowed origins for CORS
CORS_ORIGIN=http://localhost:5173
# Local Redis (installed above)
REDIS_URL=redis://127.0.0.1:6379
EOF
  echo "[i] Wrote backend/.env"
fi

echo "[7/8] Starting with PM2"
pm2 start ecosystem.config.js
pm2 save

echo "[8/8] Done. Backend listening on port 3001."
echo "Use: pm2 status | pm2 logs watchtogtr-backend --lines 200"
