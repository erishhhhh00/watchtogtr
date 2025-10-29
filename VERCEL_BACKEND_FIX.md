# 🚀 Fix Vercel "Failed to join as guest" Error

## Problem
Vercel pe frontend host ho gaya but backend nahi chal raha. Vercel **doesn't support WebSocket** (Socket.IO) for backend properly.

## Solution: Deploy Backend Separately

### Option 1: Render.com (FREE & Easy) ⭐ RECOMMENDED

1. **Create Render Account**
   - Go to https://render.com
   - Sign up with GitHub

2. **Deploy Backend**
   - Click "New +" → "Web Service"
   - Connect your GitHub repo: `erishhhhh00/watchtogtr`
   - **Settings:**
     - Name: `watchtogtr-backend`
     - Root Directory: `backend`
     - Environment: `Node`
     - Build Command: `npm install && npm run build`
     - Start Command: `node dist/index.js`
     - Instance Type: **Free**

3. **Environment Variables** (Add in Render dashboard)
   ```
   NODE_ENV=production
   PORT=3001
   JWT_SECRET=aahana-deep-together-forever-secret-key-2024
   CORS_ORIGIN=https://your-frontend-url.vercel.app
   ```

4. **Get Backend URL**
   - After deployment, copy your backend URL: `https://watchtogtr-backend.onrender.com`

5. **Update Frontend on Vercel**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add: `VITE_API_URL` = `https://watchtogtr-backend.onrender.com`
   - Redeploy frontend

---

### Option 2: Railway.app (Also FREE)

1. Go to https://railway.app
2. Sign in with GitHub
3. New Project → Deploy from GitHub repo
4. Select `watchtogtr` → Choose `backend` folder
5. Add environment variables (same as above)
6. Deploy and copy URL

---

## Quick Fix Commands

### Update Frontend Environment Variable
```bash
# In Vercel Dashboard, set:
VITE_API_URL = https://watchtogtr-backend.onrender.com
```

### Or use Vercel CLI
```bash
vercel env add VITE_API_URL
# Enter: https://watchtogtr-backend.onrender.com
# Select: Production

# Redeploy
vercel --prod
```

---

## Verify Deployment

1. Backend health check:
   ```
   https://watchtogtr-backend.onrender.com/health
   ```

2. Test guest auth:
   ```
   curl -X POST https://watchtogtr-backend.onrender.com/api/auth/guest \
   -H "Content-Type: application/json" \
   -d '{"username":"testuser"}'
   ```

3. Frontend should now work! 🎉

---

## Current Status

✅ Frontend: Deployed on Vercel
❌ Backend: Needs separate deployment (Render/Railway)
⏳ After backend deployment → Update VITE_API_URL → Redeploy frontend

---

## Aahana 💖 DEEP - Watch Together Forever!
