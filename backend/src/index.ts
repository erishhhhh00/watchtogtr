import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth';
import { roomRouter } from './routes/rooms';
import { setupSocketHandlers } from './socket';
import { proxyRouter } from './routes/proxy';
import { rateLimiter } from './middleware/rateLimiter';
import { initRoomStore } from './storage/rooms';

dotenv.config();

// Helpers
function isDev() {
  return (process.env.NODE_ENV || 'development') !== 'production';
}

const app = express();
const httpServer = createServer(app);

// Trust proxy for production (Render, Vercel, etc.)
// This allows express-rate-limit to correctly identify clients behind reverse proxies
if (!isDev()) {
  app.set('trust proxy', 1);
}

function getAllowedOrigins(): string[] {
  // Include common localhost variants by default for dev
  const raw = process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173,https://watchtogtr-frontend.vercel.app';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function isRegexAllowed(origin?: string): boolean {
  if (!origin) return true; // non-browser tools
  try {
    const u = new URL(origin);
    const host = u.hostname;
    // Permit common hosted frontends by default in prod if env not set properly
    // - Any *.vercel.app (frontend)
    // - Any *.onrender.com (useful for preview/frontends hosted on Render)
    const allowRegexes = [/\.vercel\.app$/i, /\.onrender\.com$/i];
    return allowRegexes.some((re) => re.test(host));
  } catch {
    return false;
  }
}

// Middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // In development, allow any origin to simplify local/LAN testing
    if (isDev()) {
      return callback(null, true);
    }
    const allowed = getAllowedOrigins();
    // Allow non-browser requests (no origin) and allowed origins
    if (!origin || allowed.includes(origin) || isRegexAllowed(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());
app.use(rateLimiter);

// Routes
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.use('/api/auth', authRouter);
app.use('/api/rooms', roomRouter);
app.use('/api/proxy', proxyRouter);

// Error handling
app.use(errorHandler);

// Socket.IO setup
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (isDev()) {
        return callback(null, true);
      }
      const allowed = getAllowedOrigins();
      if (!origin || allowed.includes(origin) || isRegexAllowed(origin)) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  },
});

setupSocketHandlers(io);

const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0'; // bind to all interfaces for VPS/public access

async function startServer() {
  try {
    // Initialize room storage (Redis if REDIS_URL provided; falls back to memory)
    await initRoomStore(process.env.REDIS_URL);
    
    httpServer.listen(Number(PORT), HOST, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Listening host: ${HOST}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export { io };
