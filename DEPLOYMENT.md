# 🚀 Vercel Deployment Guide - Watch With Friends

**💕 Aahana & DEEP Together 💕**

Complete guide to deploy your Watch With Friends app on Vercel.

---

## 📋 Prerequisites

Before deploying, make sure you have:
- ✅ GitHub account
- ✅ Vercel account (sign up at https://vercel.com)
- ✅ Git installed on your computer

---

## 🔧 Step 1: Prepare Your Project

### 1.1 Initialize Git Repository (if not done)

```powershell
cd C:\Users\ErISHHH\Desktop\Watchtogtr
git init
git add .
git commit -m "Initial commit - Watch With Friends for Aahana & DEEP 💕"
```

### 1.2 Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `watch-with-friends`
3. Description: `Watch With Friends - Aahana 💖 DEEP Together`
4. Keep it **Private** (recommended) or Public
5. Click **"Create repository"**

### 1.3 Push to GitHub

```powershell
git remote add origin https://github.com/YOUR_USERNAME/watch-with-friends.git
git branch -M main
git push -u origin main
```

*(Replace `YOUR_USERNAME` with your actual GitHub username)*

---

## 🌐 Step 2: Deploy to Vercel

### Method 1: Using Vercel CLI (Recommended)

#### Install Vercel CLI:
```powershell
npm install -g vercel
```

#### Login to Vercel:
```powershell
vercel login
```

#### Deploy:
```powershell
cd C:\Users\ErISHHH\Desktop\Watchtogtr
vercel
```

Follow the prompts:
- **Set up and deploy?** → `Y`
- **Which scope?** → Select your account
- **Link to existing project?** → `N`
- **Project name?** → `watch-with-friends`
- **Directory?** → `./` (current directory)
- **Build Command?** → `cd frontend && npm install && npm run build`
- **Output Directory?** → `frontend/dist`
- **Development Command?** → `npm run dev`

#### Deploy to Production:
```powershell
vercel --prod
```

---

### Method 2: Using Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Click **"Add New..."** → **"Project"**
3. Click **"Import Git Repository"**
4. Select your GitHub repository: `watch-with-friends`
5. Configure project:

**Framework Preset:** `Vite`

**Root Directory:** `frontend`

**Build Command:**
```
npm install && npm run build
```

**Output Directory:**
```
dist
```

**Install Command:**
```
npm install
```

6. **Environment Variables** (Add these):

```
VITE_API_URL=https://your-backend-url.vercel.app
VITE_SOCKET_URL=https://your-backend-url.vercel.app
```

7. Click **"Deploy"**

---

## ⚙️ Step 3: Deploy Backend Separately

Since Vercel is optimized for frontend, we'll deploy backend separately.

### Option A: Deploy Backend to Vercel

Create `backend/vercel.json`:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "src/index.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "src/index.ts"
    }
  ]
}
```

Then deploy backend:
```powershell
cd backend
vercel --prod
```

### Option B: Deploy Backend to Railway (Better for WebSocket)

1. Go to https://railway.app
2. Sign in with GitHub
3. Click **"New Project"** → **"Deploy from GitHub repo"**
4. Select your repository
5. Choose `backend` folder
6. Railway will auto-detect and deploy!

### Option C: Deploy Backend to Render

1. Go to https://render.com
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
5. Click **"Create Web Service"**

---

## 🔐 Step 4: Configure Environment Variables

### Frontend (.env in Vercel Dashboard):

Go to Vercel Dashboard → Your Project → Settings → Environment Variables

Add these:
```
VITE_API_URL=https://your-backend-url.com
VITE_SOCKET_URL=https://your-backend-url.com
```

### Backend (.env in Railway/Render):

Add these environment variables:
```
NODE_ENV=production
PORT=3001
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
FRONTEND_URL=https://your-frontend-url.vercel.app
CORS_ORIGIN=https://your-frontend-url.vercel.app
```

---

## 📝 Step 5: Update CORS Settings

In `backend/src/index.ts`, update CORS to allow your Vercel frontend:

```typescript
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
};

app.use(cors(corsOptions));
```

---

## 🎯 Step 6: Update Frontend API URLs

In `frontend/src/services/api.ts` and `socket.ts`, update to use environment variables:

```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
```

---

## ✅ Step 7: Test Your Deployment

1. Visit your Vercel URL: `https://your-project.vercel.app`
2. Test features:
   - ✅ Create a room
   - ✅ Join a room
   - ✅ Load a video (YouTube, Google Drive)
   - ✅ Voice chat
   - ✅ Text chat
   - ✅ Synchronized playback

---

## 🚨 Troubleshooting

### Issue: WebSocket connection fails

**Solution:** Use Railway or Render for backend (better WebSocket support than Vercel)

### Issue: CORS errors

**Solution:** 
1. Check environment variables are set correctly
2. Make sure `FRONTEND_URL` in backend matches your Vercel URL
3. Check browser console for exact CORS error

### Issue: Videos not loading

**Solution:**
1. Check if YouTube API is working
2. Make sure video URLs are accessible
3. Check browser console for errors

### Issue: Voice chat not working

**Solution:**
1. Make sure your site is served over HTTPS (Vercel auto-provides this)
2. Check browser microphone permissions
3. Test on different browsers

---

## 🔄 Continuous Deployment

Once set up, every time you push to GitHub:
```powershell
git add .
git commit -m "Update: Description of changes"
git push
```

Vercel will automatically:
- ✅ Build your project
- ✅ Run tests
- ✅ Deploy to production
- ✅ Update your live site

---

## 📊 Monitor Your Deployment

### Vercel Dashboard:
- View deployment logs
- Check build status
- Monitor performance
- View analytics

### Commands:
```powershell
# View deployment logs
vercel logs

# List all deployments
vercel ls

# Open project in browser
vercel open
```

---

## 🎉 Your App is Live!

After deployment, share your link:
```
https://watch-with-friends.vercel.app
```

**Now Aahana & DEEP can watch together from anywhere! 💕**

---

## 📱 Custom Domain (Optional)

### Add Custom Domain:

1. Go to Vercel Dashboard → Your Project → Settings → Domains
2. Click **"Add Domain"**
3. Enter your domain: `aahana-deep-watch.com`
4. Follow DNS configuration instructions
5. Wait for DNS propagation (5-30 minutes)

---

## 🛡️ Security Checklist

Before going live:
- [ ] Change `JWT_SECRET` to a strong random string
- [ ] Enable HTTPS (Vercel does this automatically)
- [ ] Set proper CORS origins
- [ ] Add rate limiting
- [ ] Review environment variables
- [ ] Test on multiple devices

---

## 📞 Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check browser console (F12)
3. Test locally first: `npm run dev`
4. Check all environment variables are set

---

**Made with 💕 for Aahana & DEEP to watch together!**

**Deployment Date:** October 29, 2025
