import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { roomCreationLimiter } from '../middleware/rateLimiter';
import { AppError } from '../middleware/errorHandler';
import { Room } from '../types';
import { rooms } from '../socket';
import Joi from 'joi';

export const roomRouter = Router();

// Generate 5-digit room code
function generateRoomCode(): string {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

const createRoomSchema = Joi.object({
  name: Joi.string().min(3).max(50).required(),
  hostId: Joi.string().required(),
  maxParticipants: Joi.number().min(2).max(50).default(10),
});

roomRouter.post('/', roomCreationLimiter, async (req, res, next) => {
  try {
    const { error, value } = createRoomSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400);
    }

    const { name, hostId, maxParticipants } = value;

    const roomId = uuidv4();
    const roomCode = generateRoomCode();
    
    const room: Room = {
      id: roomId,
      code: roomCode,
      hostId,
      name,
      participants: [hostId],
      playbackState: {
        url: '',
        currentTime: 0,
        isPlaying: false,
        lastUpdated: Date.now(),
        videoType: 'mp4',
      },
      chatHistory: [],
      createdAt: new Date(),
      maxParticipants: maxParticipants || 10,
      bannedUntil: {},
    };

    // Store room in memory
    rooms.set(roomId, room);

    res.status(201).json({ room });
  } catch (err) {
    next(err);
  }
});

// Join room by code - MUST BE BEFORE /:roomId route
roomRouter.get('/code/:code', async (req, res, next) => {
  try {
    const { code } = req.params;

    // Find room by code
    let foundRoom = null;
    for (const [, room] of rooms.entries()) {
      if (room.code === code) {
        foundRoom = room;
        break;
      }
    }

    if (!foundRoom) {
      throw new AppError('Room not found with this code', 404);
    }

    res.json({ room: foundRoom });
  } catch (err) {
    next(err);
  }
});

roomRouter.get('/:roomId', async (req, res, next) => {
  try {
    const { roomId } = req.params;

    const room = rooms.get(roomId);
    if (!room) {
      throw new AppError('Room not found', 404);
    }

    res.json({ room });
  } catch (err) {
    next(err);
  }
});

roomRouter.post('/:roomId/join', async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      throw new AppError('User ID required', 400);
    }

    const roomData = rooms.get(roomId);
    if (!roomData) {
      throw new AppError('Room not found', 404);
    }

    const room: Room = roomData;

    // Check temporary ban
    const now = Date.now();
    const until = room.bannedUntil?.[userId];
    if (until && now < until) {
      const minutesLeft = Math.ceil((until - now) / 60000);
      throw new AppError(`You are temporarily banned. Try again in ${minutesLeft} minute(s).`, 403);
    }

    if (room.participants.length >= room.maxParticipants) {
      throw new AppError('Room is full', 403);
    }

    if (!room.participants.includes(userId)) {
      room.participants.push(userId);
      rooms.set(roomId, room);
    }

    res.json({ room });
  } catch (err) {
    next(err);
  }
});
