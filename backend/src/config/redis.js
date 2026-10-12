import Redis from 'ioredis';
import { env } from './env.js';

let redisClient = null;
let isRedisAvailable = false;

export function initRedis() {
  if (!env.REDIS_ENABLED) {
    console.log('[Redis] Disabled via configuration (REDIS_ENABLED=false). Running in fallback in-memory mode.');
    return null;
  }

  try {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      retryStrategy(times) {
        if (times > 3) {
          console.warn('[Redis] Max connection retry attempts reached. Falling back to in-memory mode.');
          return null; // Stop reconnecting
        }
        return Math.min(times * 500, 2000);
      },
    });

    redisClient.on('connect', () => {
      isRedisAvailable = true;
      console.log('[Redis] Connected successfully to:', env.REDIS_URL);
    });

    redisClient.on('error', (err) => {
      isRedisAvailable = false;
      console.warn(`[Redis] Connection warning: ${err.message}. Graceful fallback active.`);
    });

    redisClient.on('close', () => {
      isRedisAvailable = false;
    });

    return redisClient;
  } catch (err) {
    console.warn(`[Redis] Initialization failed: ${err.message}. Operating in fallback mode.`);
    isRedisAvailable = false;
    return null;
  }
}

export function getRedisClient() {
  return redisClient;
}

export function getRedisStatus() {
  return {
    enabled: env.REDIS_ENABLED,
    available: isRedisAvailable,
    mode: isRedisAvailable ? 'connected' : 'fallback-in-memory',
  };
}

export async function closeRedis() {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch {
      redisClient.disconnect();
    }
    isRedisAvailable = false;
  }
}
