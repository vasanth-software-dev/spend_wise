import { Redis } from 'ioredis';
import { env } from './env.js';

interface CacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, duration?: number): Promise<'OK' | null>;
  del(key: string): Promise<number>;
  flushall?(): Promise<string>;
  isOpen: boolean;
}

class InMemoryCache implements CacheClient {
  private store = new Map<string, { value: string; expiresAt?: number }>();
  public isOpen = true;

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: string, mode?: string, duration?: number): Promise<'OK'> {
    let expiresAt: number | undefined;
    if (mode === 'EX' && duration) {
      expiresAt = Date.now() + duration * 1000;
    } else if (mode === 'PX' && duration) {
      expiresAt = Date.now() + duration;
    }
    this.store.set(key, { value, expiresAt });
    return 'OK';
  }

  async del(key: string): Promise<number> {
    const deleted = this.store.delete(key);
    return deleted ? 1 : 0;
  }

  async flushall(): Promise<string> {
    this.store.clear();
    return 'OK';
  }
}

let redisClient: CacheClient;

export function initRedis(): CacheClient {
  try {
    const redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => {
        if (times > 3) {
          return null; // Stop retrying
        }
        return Math.min(times * 100, 500);
      },
      lazyConnect: true,
      enableOfflineQueue: false,
    });

    redis.on('error', (err) => {
      // Suppress unhandled EventEmitter crash
      if (!redisClient || !(redisClient instanceof InMemoryCache)) {
        console.warn(`⚠️ Redis unreachable: ${err.message}. Using In-Memory Cache fallback.`);
        redisClient = new InMemoryCache();
      }
    });

    redis.connect().then(() => {
      console.log('✅ Redis connected successfully.');
      redisClient = redis as unknown as CacheClient;
    }).catch((err) => {
      console.warn(`⚠️ Redis not reachable (${err.message}). Using In-Memory Cache fallback.`);
      try { redis.disconnect(); } catch (_) {}
      redisClient = new InMemoryCache();
    });

    // Default to InMemoryCache initially until connected
    redisClient = new InMemoryCache();
  } catch (err) {
    console.warn('⚠️ Failed to initialize Redis. Using In-Memory Cache fallback.');
    redisClient = new InMemoryCache();
  }

  return redisClient;
}

export function getCache(): CacheClient {
  if (!redisClient) {
    return initRedis();
  }
  return redisClient;
}
