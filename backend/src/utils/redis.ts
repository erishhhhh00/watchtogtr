import { createClient, RedisClientType } from 'redis';
import { logger } from './logger';

let redisClient: RedisClientType | null = null;

export async function connectRedis(): Promise<RedisClientType | null> {
  // Only use Redis in production
  if (process.env.NODE_ENV !== 'production' || !process.env.REDIS_URL) {
    logger.info('Redis disabled - using in-memory storage');
    return null;
  }

  try {
    const client = createClient({
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis connection failed after 10 retries');
            return new Error('Redis connection failed');
          }
          return retries * 500; // Exponential backoff
        },
      },
    });

    client.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    client.on('connect', () => {
      logger.info('✅ Redis connected successfully');
    });

    client.on('reconnecting', () => {
      logger.warn('⚠️ Redis reconnecting...');
    });

    await client.connect();
    redisClient = client;
    return client;
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    return null;
  }
}

export function getRedisClient(): RedisClientType | null {
  return redisClient;
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    logger.info('Redis disconnected');
  }
}
