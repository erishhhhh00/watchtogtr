import { createClient, RedisClientType } from 'redis';
import { Room } from '../types';
import { logger } from '../utils/logger';

// Fallback in-memory store
const memRooms = new Map<string, Room>();

let redisClient: RedisClientType | null = null;
let useRedis = false;

export async function initRoomStore(redisUrl?: string) {
  try {
    if (!redisUrl) {
      logger.info('RoomStore: Using in-memory storage (no REDIS_URL)');
      useRedis = false;
      return;
    }
    redisClient = createClient({ url: redisUrl });
    redisClient.on('error', (err) => logger.error('Redis error:', err));
    await redisClient.connect();
    useRedis = true;
    logger.info('RoomStore: Connected to Redis');
  } catch (err) {
    logger.warn('RoomStore: Failed to connect to Redis, falling back to memory:', err as any);
    useRedis = false;
  }
}

const roomKey = (roomId: string) => `room:${roomId}`;
const roomCodeKey = (code: string) => `room:code:${code}`;
const roomIdsKey = 'rooms:ids';

export async function getRoom(roomId: string): Promise<Room | null> {
  if (!useRedis || !redisClient) {
    return memRooms.get(roomId) || null;
  }
  const raw = await redisClient.get(roomKey(roomId));
  return raw ? (JSON.parse(raw) as Room) : null;
}

export async function setRoom(roomId: string, room: Room): Promise<void> {
  if (!useRedis || !redisClient) {
    memRooms.set(roomId, room);
    return;
  }
  const tx = redisClient.multi();
  tx.set(roomKey(roomId), JSON.stringify(room));
  if (room.code) {
    tx.set(roomCodeKey(room.code), roomId);
  }
  tx.sAdd(roomIdsKey, roomId);
  await tx.exec();
}

export async function findRoomByCode(code: string): Promise<Room | null> {
  if (!useRedis || !redisClient) {
    for (const [, r] of memRooms.entries()) {
      if (r.code === code) return r;
    }
    return null;
  }
  const roomId = await redisClient.get(roomCodeKey(code));
  if (!roomId) return null;
  return getRoom(roomId);
}

export async function getRoomsCount(): Promise<number> {
  if (!useRedis || !redisClient) {
    return memRooms.size;
  }
  const ids = await redisClient.sMembers(roomIdsKey);
  return ids.length;
}

export function isRedisEnabled() {
  return useRedis;
}
