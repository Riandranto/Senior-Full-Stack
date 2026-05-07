import session from 'express-session';
import { redisStore } from './redis.js';
import createMemoryStore from 'memorystore';
import { logger } from '../utils/logger.js';

const MemoryStore = createMemoryStore(session);
export const isProduction = process.env.NODE_ENV === 'production';
export let redisAvailable = false;

export async function getSessionStore() {
  let store;
  if (redisStore) {
    try {
      if (redisStore.client && redisStore.client.connected) {
        store = redisStore;
        redisAvailable = true;
        logger.info('Redis session store initialized');
      } else {
        logger.warn('Redis not connected, falling back to MemoryStore');
      }
    } catch (err) {
      logger.error({ err }, 'Redis connection error');
    }
  }
  if (!store) {
    logger.info('Using MemoryStore for sessions');
    store = new MemoryStore({ checkPeriod: 86400000 });
  }
  return store;
}

export const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'super-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  name: isProduction ? '__Secure-farady.sid' : 'farady.sid',
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' as const : 'lax' as const,
    path: '/',
    domain: isProduction ? process.env.DOMAIN || '.ride-mada-mg.up.railway.app' : undefined,
  },
  rolling: true,
  proxy: isProduction,
};

export async function createSessionMiddleware() {
  const store = await getSessionStore();
  return session({ ...sessionConfig, store });
}

let sessionMiddleware: any = null;
export async function initializeSession() {
  sessionMiddleware = await createSessionMiddleware();
  return sessionMiddleware;
}

export function getSessionMiddleware() {
  if (!sessionMiddleware) throw new Error('Session middleware not initialized');
  return sessionMiddleware;
}