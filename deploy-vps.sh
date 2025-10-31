#!/bin/bash

# 🚀 One-Command VPS Deployment Script
# This script automates the entire deployment process

set -e  # Exit on error

echo "🚀 Starting Watch-With-Friends VPS Deployment..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get VPS public IP
echo "📡 Detecting VPS public IP..."
VPS_IP=$(curl -s ifconfig.me)
echo -e "${GREEN}✓ VPS IP: $VPS_IP${NC}"
echo ""

# Check if required software is installed
echo "🔍 Checking prerequisites..."
command -v node >/dev/null 2>&1 || { echo -e "${RED}✗ Node.js not installed. Please install Node.js 20+${NC}"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo -e "${RED}✗ npm not installed${NC}"; exit 1; }
command -v ffmpeg >/dev/null 2>&1 || { echo -e "${RED}✗ FFmpeg not installed. Run: sudo apt install -y ffmpeg${NC}"; exit 1; }
command -v redis-cli >/dev/null 2>&1 || { echo -e "${RED}✗ Redis not installed. Run: sudo apt install -y redis-server${NC}"; exit 1; }
command -v pm2 >/dev/null 2>&1 || { echo -e "${RED}✗ PM2 not installed. Run: sudo npm install -g pm2${NC}"; exit 1; }
echo -e "${GREEN}✓ All prerequisites satisfied${NC}"
echo ""

# Test Redis connection
echo "🔌 Testing Redis connection..."
if redis-cli ping | grep -q PONG; then
    echo -e "${GREEN}✓ Redis is running${NC}"
else
    echo -e "${RED}✗ Redis not running. Starting Redis...${NC}"
    sudo systemctl start redis-server
    sleep 2
    if redis-cli ping | grep -q PONG; then
        echo -e "${GREEN}✓ Redis started successfully${NC}"
    else
        echo -e "${RED}✗ Failed to start Redis${NC}"
        exit 1
    fi
fi
echo ""

# Deploy Backend
echo "📦 Deploying Backend..."
cd backend

# Create production env file
cat > .env.production << EOF
NODE_ENV=production
PORT=3001
JWT_SECRET=$(openssl rand -base64 32)
CORS_ORIGIN=*
REDIS_URL=redis://localhost:6379
EOF

echo -e "${GREEN}✓ Production environment file created${NC}"

# Install dependencies
echo "📥 Installing backend dependencies..."
npm install --production=false

# Build TypeScript
echo "🔨 Building backend..."
npm run build

# Stop existing PM2 process if running
pm2 delete backend 2>/dev/null || true

# Start with PM2
echo "🚀 Starting backend with PM2..."
pm2 start ecosystem.config.js --env production
echo -e "${GREEN}✓ Backend deployed successfully${NC}"
echo ""

# Deploy Frontend
echo "📦 Deploying Frontend..."
cd ../frontend

# Create production env file with VPS IP
cat > .env.production << EOF
VITE_API_URL=http://$VPS_IP:3001
VITE_SOCKET_URL=http://$VPS_IP:3001
EOF

echo -e "${GREEN}✓ Frontend environment file created with VPS IP${NC}"

# Install dependencies
echo "📥 Installing frontend dependencies..."
npm install

# Build for production
echo "🔨 Building frontend..."
npm run build

# Stop existing PM2 process if running
pm2 delete frontend 2>/dev/null || true

# Start with PM2 (serve the built files)
echo "🚀 Starting frontend with PM2..."
pm2 start npm --name "frontend" -- run preview -- --host 0.0.0.0 --port 5173

echo -e "${GREEN}✓ Frontend deployed successfully${NC}"
echo ""

# Save PM2 configuration
echo "💾 Saving PM2 configuration..."
pm2 save

# Setup PM2 startup script
echo "🔧 Configuring PM2 auto-start on boot..."
pm2 startup | grep -oP 'sudo.*' | sh || echo -e "${YELLOW}⚠ Please run PM2 startup command manually if needed${NC}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🎉 DEPLOYMENT SUCCESSFUL! 🎉${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📱 Your Watch-With-Friends app is now live at:"
echo -e "${GREEN}Frontend: http://$VPS_IP:5173${NC}"
echo -e "${GREEN}Backend:  http://$VPS_IP:3001${NC}"
echo ""
echo "🌍 Share this link with your friends:"
echo -e "${YELLOW}http://$VPS_IP:5173${NC}"
echo ""
echo "📊 Useful commands:"
echo "  pm2 status          - View all services"
echo "  pm2 logs            - View all logs"
echo "  pm2 restart all     - Restart all services"
echo "  pm2 monit           - Monitor resources"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
