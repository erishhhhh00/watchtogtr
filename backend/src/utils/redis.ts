import { createClient, RedisClientType } from 'redis';
import { logger } from './logger';

let client: RedisClientType | null = null;

/**
 * Lazy Redis client initializer used by modules that want a shared client.
 * Returns null if no URL is provided.
 */
export async function getRedis(url?: string): Promise<RedisClientType | null> {
  if (client && (client as any).isOpen) return client;
  if (!url) return null;
  try {
    const c = createClient({ url });
    c.on('error', (err) => logger.error('Redis client error:', err));
    await c.connect();
    client = c as unknown as RedisClientType;
    logger.info('utils/redis: connected');
    return client;
  } catch (err) {
    logger.warn('utils/redis: failed to connect, returning null');
    return null;
  }
}

export function getRedisSync(): RedisClientType | null {
  return client;
}

export async function disconnectRedis(): Promise<void> {
  if (client) {
    try { await client.disconnect(); } catch {}
    client = null;
  }
}
