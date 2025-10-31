# 🚀 Google Cloud VPS Setup Guide (No Domain Required)

## Prerequisites
- Google Cloud account ($300 free credit for 90 days)
- SSH client (PuTTY for Windows or built-in terminal)
- This project repository

---

## 📦 Part 1: Create Google Cloud VPS

### Step 1: Create VM Instance
```bash
1. Go to: https://console.cloud.google.com/compute
2. Click "CREATE INSTANCE"
3. Configure:
   - Name: watchtogtr-vps
   - Region: Choose nearest (e.g., asia-south1 for India)
   - Machine type: e2-small (2 vCPU, 2 GB memory) - $13/month
   - Boot disk: Ubuntu 22.04 LTS, 20 GB SSD
   - Firewall: ✅ Allow HTTP traffic, ✅ Allow HTTPS traffic
4. Click "CREATE"
```

### Step 2: Configure Firewall Rules
```bash
1. Go to: VPC Network → Firewall
2. Click "CREATE FIREWALL RULE"
3. Settings:
   - Name: allow-watchtogtr
   - Direction: Ingress
   - Action: Allow
   - Targets: All instances
   - Source IPv4 ranges: 0.0.0.0/0
   - Protocols: TCP ports 3001, 5173, 6379
4. Click "CREATE"
```

### Step 3: Get Your Public IP
```bash
# Your VPS IP will be shown in Compute Engine → VM instances
# Example: 34.131.45.123

# Save this IP - this is your public access point!
```

---

## 🔧 Part 2: Install Required Software

### Connect to VPS via SSH
```bash
# From Google Cloud Console, click "SSH" button next to your instance
# Or use: gcloud compute ssh watchtogtr-vps
```

### Install Everything (Copy-Paste This Entire Block)
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install FFmpeg (for MKV transcoding)
sudo apt install -y ffmpeg

# Install Redis (for room persistence)
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Git
sudo apt install -y git

# Verify installations
node -v      # Should show v20.x.x
npm -v       # Should show v10.x.x
ffmpeg -version  # Should show FFmpeg version
redis-cli ping   # Should return "PONG"
pm2 -v       # Should show PM2 version

echo "✅ All software installed successfully!"
```

---

## 📂 Part 3: Deploy Your Application

### Clone Repository
```bash
# Clone your repo
git clone https://github.com/erishhhhh00/watchtogtr.git
cd watchtogtr
```

### Setup Backend
```bash
cd backend

# Install dependencies
npm install

# Install Redis adapter for Socket.IO
npm install @socket.io/redis-adapter redis

# Create production environment file
cat > .env.production << 'EOF'
NODE_ENV=production
PORT=3001
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-12345
CORS_ORIGIN=*
REDIS_URL=redis://localhost:6379
EOF

# Build TypeScript
npm run build

# Start with PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup  # Copy and run the command it shows
```

### Setup Frontend
```bash
cd ../frontend

# Install dependencies
npm install

# Get your VPS IP address
VPS_IP=$(curl -s ifconfig.me)
echo "Your VPS IP: $VPS_IP"

# Create production environment file
cat > .env.production << EOF
VITE_API_URL=http://$VPS_IP:3001
VITE_SOCKET_URL=http://$VPS_IP:3001
EOF

# Build for production
npm run build

# Serve with PM2
pm2 start npm --name "frontend" -- run preview -- --host 0.0.0.0 --port 5173
pm2 save
```

### Verify Everything is Running
```bash
pm2 status

# Should show:
# ┌─────┬────────────┬─────────┬─────────┐
# │ id  │ name       │ status  │ restart │
# ├─────┼────────────┼─────────┼─────────┤
# │ 0   │ backend    │ online  │ 0       │
# │ 1   │ frontend   │ online  │ 0       │
# └─────┴────────────┴─────────┴─────────┘

pm2 logs  # Check logs for any errors
```

---

## 🌍 Part 4: Access Your App Publicly

### Your Public URLs:
```bash
# Get your IP
curl ifconfig.me

# Your app is now live at:
Frontend: http://YOUR_VPS_IP:5173
Backend:  http://YOUR_VPS_IP:3001

# Example:
# http://34.131.45.123:5173  ← Share this with friends!
# http://34.131.45.123:3001  ← Backend API
```

### Test Access
```bash
# Test backend health
curl http://YOUR_VPS_IP:3001/health

# Should return: {"status":"ok","uptime":123.45}
```

---

## 🎯 Part 5: Share With Friends

**Anyone in the world can now access your app!**

Just share: `http://YOUR_VPS_IP:5173`

Example sharing message:
```
Hey! Join me to watch videos together:
http://34.131.45.123:5173

Just open this link and create/join a room! 🎬
```

---

## 🔄 Part 6: Update Your App (When You Push Changes)

```bash
# SSH into VPS
cd ~/watchtogtr

# Pull latest changes
git pull origin main

# Update Backend
cd backend
npm install
npm run build
pm2 restart backend

# Update Frontend
cd ../frontend
npm install
npm run build
pm2 restart frontend

echo "✅ App updated successfully!"
```

---

## 📊 Monitoring Commands

```bash
# View all processes
pm2 status

# View logs
pm2 logs

# View backend logs only
pm2 logs backend

# Monitor resources
pm2 monit

# Restart services
pm2 restart all
pm2 restart backend
pm2 restart frontend

# Stop services
pm2 stop all

# Check Redis
redis-cli ping
redis-cli INFO
```

---

## 🐛 Troubleshooting

### Frontend can't connect to backend:
```bash
# Check if backend is running
pm2 logs backend

# Check firewall
sudo ufw status
sudo ufw allow 3001
sudo ufw allow 5173

# Verify CORS is set to * in backend/.env.production
```

### Rooms not persisting after restart:
```bash
# Check Redis is running
redis-cli ping

# Should return "PONG"
# If not:
sudo systemctl restart redis-server
```

### FFmpeg not working for MKV:
```bash
# Test FFmpeg
ffmpeg -version

# Check backend logs
pm2 logs backend --lines 100
```

### Out of memory:
```bash
# Check RAM usage
free -h

# Restart services to free memory
pm2 restart all
```

---

## 💰 Cost Breakdown

**Google Cloud e2-small (2GB RAM)**
- Monthly: ~$13-15
- With $300 free credit: **20 months FREE!**
- After credit: ~$13/month

**What You Get:**
- ✅ 3GB+ MKV file support
- ✅ Permanent room storage (Redis)
- ✅ 24/7 uptime (no sleep)
- ✅ 10-15+ concurrent users
- ✅ Fast transcoding
- ✅ Public access worldwide

---

## 🎉 Success Checklist

- [ ] VPS created on Google Cloud
- [ ] Firewall rules configured (ports 3001, 5173)
- [ ] Node.js, FFmpeg, Redis, PM2 installed
- [ ] Backend running on PM2
- [ ] Frontend running on PM2
- [ ] Can access `http://YOUR_IP:5173` from browser
- [ ] Can create room and play video
- [ ] MKV files transcode successfully
- [ ] Rooms persist after server restart

---

## 🔗 Quick Reference

**Your VPS IP:** `_________________` (write it here)

**Access URLs:**
- App: `http://YOUR_IP:5173`
- API: `http://YOUR_IP:3001`

**SSH Command:**
```bash
gcloud compute ssh watchtogtr-vps
```

**Common Commands:**
```bash
pm2 status          # Check if services running
pm2 logs            # View all logs
pm2 restart all     # Restart everything
git pull            # Update code
```

---

## 🆘 Need Help?

1. Check logs: `pm2 logs`
2. Check firewall: `sudo ufw status`
3. Check Redis: `redis-cli ping`
4. Restart everything: `pm2 restart all`

**Your app is now live and accessible to anyone worldwide! 🌍🎉**
