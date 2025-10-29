# Watch-With-Friends - Quick Start Guide

## 🎯 What's Been Built

A complete full-stack synchronized video watching platform with:
- ✅ Real-time synchronized playback across all participants
- ✅ Voice chat using WebRTC (P2P)
- ✅ Text chat with message history
- ✅ Room creation and invite links
- ✅ Host controls (play/pause/seek/kick)
- ✅ Guest and registered user support
- ✅ Mobile-responsive UI with dark theme
- ✅ Docker deployment ready

## 📁 Project Structure

```
Watchtogtr/
├── backend/          # Node.js + Express + Socket.IO server
│   ├── src/
│   │   ├── index.ts           # Main server entry
│   │   ├── socket/index.ts    # Socket.IO handlers (sync logic)
│   │   ├── routes/            # REST API endpoints
│   │   ├── middleware/        # Auth, rate limiting, errors
│   │   └── types/             # TypeScript interfaces
│   └── package.json
├── frontend/         # React + TypeScript + Vite
│   ├── src/
│   │   ├── pages/            # Landing & Room pages
│   │   ├── components/       # VideoPlayer, Chat, Controls
│   │   ├── services/         # API & Socket.IO clients
│   │   └── stores/           # Zustand state management
│   └── package.json
├── docker-compose.yml
├── README.md
└── API.md           # Complete API documentation
```

## 🚀 How to Run

### Option 1: Local Development (Recommended for development)

**Prerequisites:**
- Node.js 18+ and npm
- Redis server running on port 6379

**Step 1: Install Redis**
```bash
# Windows (using Chocolatey)
choco install redis-64

# Or download from: https://redis.io/download

# Start Redis
redis-server
```

**Step 2: Start Backend**
```bash
cd backend
npm install
npm run dev
```
Backend runs on: http://localhost:3001

**Step 3: Start Frontend** (in new terminal)
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on: http://localhost:5173

### Option 2: Docker (Recommended for deployment)

```bash
# Build and start all services
docker-compose up --build

# Stop services
docker-compose down
```

## 🎮 How to Use

1. **Open** http://localhost:5173
2. **Create Room** or **Join** with a guest username
3. **Share** the room URL with friends
4. **Add Video URL** (host only) - supports:
   - Direct MP4 links
   - HLS streams
   - YouTube videos (experimental)
5. **Control Playback** using the video player controls
6. **Chat** and **Voice** with participants in real-time

## 🔑 Key Features Explained

### Synchronized Playback Algorithm
Located in: `backend/src/socket/index.ts`

**How it works:**
1. Server maintains master playback state (time, playing/paused)
2. Every 5 seconds, server broadcasts current state with server timestamp
3. Clients calculate local offset: `serverTime - clientTime`
4. If drift > 500ms, client auto-corrects video position
5. All play/pause/seek events go through server for consistency

### WebRTC Voice Chat
Located in: `frontend/src/services/socket.ts`

**Flow:**
1. User A creates offer → sends via Socket.IO to server
2. Server relays offer to User B
3. User B creates answer → sends back via server
4. Both users exchange ICE candidates through server
5. Direct P2P audio connection established
6. TURN server used as fallback for NAT traversal

### Security Features
- ✅ Rate limiting on auth & room creation
- ✅ XSS protection (HTML escaping in chat)
- ✅ CORS configuration
- ✅ JWT authentication
- ✅ Input validation with Joi

## 📊 API Overview

See `API.md` for complete documentation.

**REST Endpoints:**
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `POST /api/auth/guest` - Join as guest
- `POST /api/rooms` - Create room
- `GET /api/rooms/:id` - Get room info
- `POST /api/rooms/:id/join` - Join room

**Socket.IO Events:**
- `join-room`, `play`, `pause`, `seek`
- `chat-message`
- `webrtc-offer`, `webrtc-answer`, `webrtc-ice-candidate`
- `sync-state` (broadcast every 5s)

## 🔧 Configuration

### Backend `.env`
```env
PORT=3001
NODE_ENV=development
REDIS_URL=redis://localhost:6379
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=your-secret-key-change-in-production
STUN_SERVERS=stun:stun.l.google.com:19302
```

### Frontend `.env`
```env
VITE_API_URL=http://localhost:3001
VITE_WS_URL=http://localhost:3001
```

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

## 📦 Building for Production

```bash
# Build backend
cd backend
npm run build
npm start

# Build frontend
cd frontend
npm run build
npm run preview
```

## 🐛 Troubleshooting

**Redis Connection Error:**
- Ensure Redis is running: `redis-cli ping` should return `PONG`
- Check REDIS_URL in backend/.env

**Socket.IO Connection Issues:**
- Check CORS settings match frontend URL
- Verify backend is running on correct port
- Check browser console for WebSocket errors

**Video Won't Play:**
- Ensure video URL is publicly accessible
- Check browser console for CORS errors
- Try a direct MP4 link first (e.g., https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4)

**Voice Chat Not Working:**
- Grant microphone permissions in browser
- Check WebRTC console logs
- Verify STUN server is accessible

## 📝 Next Steps / Enhancements

**Recommended additions:**
- [ ] Add PostgreSQL for persistent storage
- [ ] Implement full WebRTC SFU (mediasoup) for better voice scaling
- [ ] Add YouTube iframe API integration
- [ ] Implement screen sharing
- [ ] Add user profiles and avatars
- [ ] Playlist management
- [ ] Room passwords
- [ ] Recording functionality
- [ ] TURN server configuration for better NAT traversal

## 📚 Code Highlights

**Sync Algorithm:** `backend/src/socket/index.ts` (lines 6-21)
**Video Player:** `frontend/src/components/VideoPlayer.tsx`
**Socket Service:** `frontend/src/services/socket.ts`
**Room Logic:** `frontend/src/pages/Room.tsx`

## 🔐 Security Notes

**Important:**
- Change `JWT_SECRET` in production
- Use HTTPS in production
- Configure proper TURN server for production WebRTC
- Review and update CORS origins
- Users must have rights to stream shared content
- Implement DMCA takedown process for production

## 🤝 Contributing

This is a complete MVP. Feel free to extend with:
- Database integration
- Better WebRTC mesh/SFU
- More video sources
- Enhanced UI/UX
- Mobile apps

---

**Built with ❤️ for watching videos with friends!**
