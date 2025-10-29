# 🎬 Watch With Friends

**💕 Aahana & DEEP Together 💕**

A real-time synchronized video watching platform built with love for watching movies, shows, and videos together. Perfect for long-distance movie nights, watch parties, and sharing special moments.

---

## ✨ Made with Love

This app was specially created for **Aahana 💖 DEEP** to watch together, no matter the distance.

**Special Features:**
- 💕 **Together Forever** - Watch anything, anytime, together
- 🎬 **Perfect Sync** - Never miss a moment (< 500ms drift)
- 🎤 **Voice Chat** - Talk while you watch
- 💬 **Live Chat** - Share reactions in real-time
- 📺 **Multi-Platform** - YouTube, Google Drive, Seedr, Direct Links

---

## 🚀 Deployment

### Quick Deploy to Vercel (2 Minutes!)

```powershell
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel

# Deploy to production
vercel --prod
```

**📖 For detailed deployment instructions, see:**
- **`DEPLOY_NOW.md`** - Quick 5-minute guide
- **`DEPLOYMENT.md`** - Complete deployment guide with all options

### Alternative Deployment Options:
- **Vercel** - Frontend (Recommended)
- **Railway** - Backend (Best for WebSocket)
- **Render** - Full-stack option
- **Netlify** - Alternative for frontend

---

## Features

- **Synchronized Playback**: Watch videos in perfect sync with server-authoritative clock and drift correction
- **Voice Chat**: WebRTC-powered group voice communication
- **Text Chat**: Real-time messaging within rooms
- **Room Management**: Create rooms and invite friends via shareable links
- **Host Controls**: Play/pause, seek, mute users, kick participants
- **Multi-Source Support**: YouTube, direct MP4/HLS links, Vimeo
- **Mobile-First**: Responsive design that works on all devices
- **Secure**: HTTPS, rate limiting, XSS protection, input sanitization

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development
- **Socket.IO Client** for real-time communication
- **WebRTC** for peer-to-peer voice chat
- **TailwindCSS** for styling
- **Zustand** for state management

### Backend
- **Node.js** with TypeScript
- **Express** for REST API
- **Socket.IO** for WebSocket communication
- **Redis** for pub/sub and session management
- **PostgreSQL** for data persistence (optional)
- **WebRTC signaling** for voice chat coordination

## Architecture

### Synchronization Algorithm
The app uses a **server-authoritative clock** approach:
1. Server maintains the master playback state (timestamp, playing/paused, current time)
2. Clients send control events (play/pause/seek) to server
3. Server broadcasts authoritative state with server timestamp
4. Clients apply drift correction every 5 seconds to stay in sync
5. Maximum acceptable drift: 500ms before auto-correction

### WebRTC Flow
1. User joins room → Socket.IO connection established
2. New peer detected → Exchange ICE candidates via signaling server
3. STUN/TURN servers help with NAT traversal
4. Direct peer-to-peer audio streams established
5. Fallback to TURN relay if P2P fails

## Quick Start

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0
- Redis (for production) or Docker
- (Optional) PostgreSQL

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd watch-with-friends
   ```

2. **Install dependencies**
   ```bash
   npm run install:all
   ```

3. **Configure environment variables**

   Backend (`backend/.env`):
   ```env
   PORT=3001
   NODE_ENV=development
   REDIS_URL=redis://localhost:6379
   CORS_ORIGIN=http://localhost:5173
   JWT_SECRET=your-secret-key-change-in-production
   STUN_SERVERS=stun:stun.l.google.com:19302
   ```

   Frontend (`frontend/.env`):
   ```env
   VITE_API_URL=http://localhost:3001
   VITE_WS_URL=http://localhost:3001
   ```

4. **Start Redis** (if not using Docker)
   ```bash
   redis-server
   ```

5. **Run development servers**
   ```bash
   npm run dev
   ```

   Frontend: http://localhost:5173
   Backend: http://localhost:3001

### Docker Setup

1. **Build and start all services**
   ```bash
   docker-compose up --build
   ```

2. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001

3. **Stop services**
   ```bash
   docker-compose down
   ```

## Project Structure

```
watch-with-friends/
├── frontend/                 # React TypeScript frontend
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── services/        # API and Socket.IO services
│   │   ├── stores/          # Zustand state stores
│   │   ├── types/           # TypeScript type definitions
│   │   └── utils/           # Utility functions
│   ├── public/
│   └── package.json
├── backend/                  # Node.js TypeScript backend
│   ├── src/
│   │   ├── controllers/     # Route controllers
│   │   ├── services/        # Business logic
│   │   ├── socket/          # Socket.IO handlers
│   │   ├── middleware/      # Express middleware
│   │   ├── models/          # Data models
│   │   └── utils/           # Utility functions
│   ├── tests/
│   └── package.json
├── docker-compose.yml
└── README.md
```

## API Documentation

### REST Endpoints

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/rooms` - Create new room
- `GET /api/rooms/:roomId` - Get room details
- `POST /api/rooms/:roomId/join` - Join room (guest or authenticated)

### Socket.IO Events

**Client → Server:**
- `join-room` - Join a specific room
- `play` - Play video
- `pause` - Pause video
- `seek` - Seek to timestamp
- `chat-message` - Send chat message
- `webrtc-offer` - WebRTC offer for voice
- `webrtc-answer` - WebRTC answer for voice
- `webrtc-ice-candidate` - ICE candidate exchange

**Server → Client:**
- `room-state` - Current room state
- `sync-state` - Periodic sync update
- `user-joined` - User joined notification
- `user-left` - User left notification
- `chat-message` - Broadcast chat message
- `webrtc-offer` - Relay WebRTC offer
- `webrtc-answer` - Relay WebRTC answer
- `webrtc-ice-candidate` - Relay ICE candidate

## Security Features

- **HTTPS Only** in production
- **Rate Limiting** on auth and room creation endpoints
- **XSS Protection** via input sanitization and escaping
- **CORS Configuration** with whitelist
- **JWT Authentication** for user sessions
- **Content Policy** - Users must have rights to shared content

## Testing

```bash
# Run all tests
npm test

# Backend tests only
npm run test --prefix backend

# Frontend tests only
npm run test --prefix frontend
```

## Deployment

### Environment Variables (Production)

Ensure these are set:
- `NODE_ENV=production`
- `JWT_SECRET` - Strong random secret
- `REDIS_URL` - Production Redis instance
- `DATABASE_URL` - PostgreSQL connection string (if using)
- `CORS_ORIGIN` - Your frontend domain
- `TURN_SERVER_URL` - TURN server for WebRTC relay
- `TURN_SERVER_USERNAME` and `TURN_SERVER_CREDENTIAL`

### Build for Production

```bash
npm run build
```

### Docker Deployment

```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Legal & Compliance

**Important**: This application provides a platform for users to share video URLs. Users are responsible for ensuring they have the legal rights to stream any content they share. The application does not host or provide copyrighted content.

- Review `TERMS_OF_SERVICE.md` for usage terms
- DMCA takedown process available at `/dmca`
- Content reporting and blocking features included

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - See LICENSE file for details

## Support

For issues and questions, please open a GitHub issue.

---

Built with ❤️ for watching videos with friends
