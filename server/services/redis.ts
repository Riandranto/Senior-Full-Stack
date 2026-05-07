import { createClient } from 'redis';
import RedisStore from 'connect-redis';
import { logger } from '../utils/logger.js';

let redisClient: ReturnType<typeof createClient> | null = null;
let redisStore: any = null;

const REDIS_URL = process.env.REDIS_URL || process.env.REDIS_TLS_URL;

if (REDIS_URL) {
  redisClient = createClient({
    url: REDIS_URL,
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

  redisClient.on('error', (err) => logger.error({ err }, 'Redis Client Error'));
  redisClient.on('connect', () => logger.info('Redis Client Connected'));

  redisStore = new RedisStore({ client: redisClient, prefix: 'farady:session:', ttl: 86400 });
} else {
  logger.info('REDIS_URL not set, using memory store fallback');
}

export async function initializeRedis() {
  if (!redisClient) {
    logger.info('Redis not configured');
    return false;
  }
  try {
    await redisClient.connect();
    logger.info('Redis connected');
    return true;
  } catch (error) {
    logger.error({ error }, 'Redis connection failed');
    redisClient = null;
    return false;
  }
}

export { redisStore };