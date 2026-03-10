import { createClient } from 'redis';
import RedisStore from 'connect-redis';
import session from 'express-session';
import { logger } from '../utils/logger';

// Client Redis
export const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        logger.error('Redis max retries reached');
        return new Error('Redis max retries reached');
      }
      return Math.min(retries * 100, 3000);
    }
  }
});

redisClient.on('error', (err) => {
  logger.error({ err }, 'Redis Client Error');
});

redisClient.on('connect', () => {
  logger.info('Redis Client Connected');
});

// Session store
export const redisStore = new RedisStore({
  client: redisClient,
  prefix: 'farady:session:',
  ttl: 86400 // 24 heures en secondes
});

// Initialisation
export async function initializeRedis() {
  try {
    await redisClient.connect();
    logger.info('Redis initialized successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize Redis');
    // Fallback à memory store en développement
    if (process.env.NODE_ENV === 'development') {
      logger.warn('Using memory store fallback');
      return;
    }
    throw error;
  }
}

// Health check
export async function checkRedisHealth(): Promise<boolean> {
  try {
    await redisClient.ping();
    return true;
  } catch {
    return false;
  }
}