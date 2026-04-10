import session from 'express-session';
import { redisStore } from './redis.js';
import createMemoryStore from 'memorystore';

const MemoryStore = createMemoryStore(session);

// Configuration de la session
export const isProduction = process.env.NODE_ENV === 'production';
let redisAvailable = false;

// Fonction pour obtenir le store de session
export async function getSessionStore() {
  let store;
  
  // Essayer d'utiliser Redis si disponible
  if (redisStore) {
    try {
      console.log('🔄 Tentative de connexion à Redis...');
      // Vérifier si Redis est connecté
      if (redisStore.client && redisStore.client.connected) {
        store = redisStore;
        redisAvailable = true;
        console.log('✅ Redis session store initialized');
      } else {
        console.warn('⚠️ Redis not connected, falling back to MemoryStore');
      }
    } catch (err) {
      console.error('❌ Redis connection error:', err);
      console.warn('⚠️ Falling back to MemoryStore');
    }
  }
  
  if (!store) {
    console.log('📦 Using MemoryStore for sessions');
    store = new MemoryStore({
      checkPeriod: 86400000, // Nettoyer les sessions expirées toutes les 24h
    });
  }
  
  return store;
}

// Configuration de session par défaut
export const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'super-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  name: isProduction ? '__Secure-farady.sid' : 'farady.sid',
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 jours
    httpOnly: true,
    secure: isProduction, // Secure uniquement en HTTPS
    sameSite: isProduction ? 'strict' as const : 'lax' as const,
    path: '/',
    domain: isProduction ? process.env.DOMAIN || '.ride-mada-mg.up.railway.app' : undefined,
  },
  rolling: true, // Renouvelle le cookie à chaque requête
  proxy: isProduction, // Trust proxy en production
};

// Fonction pour créer le middleware de session
export async function createSessionMiddleware() {
  const store = await getSessionStore();
  
  const config = {
    ...sessionConfig,
    store,
  };
  
  console.log('📦 Session config:', {
    store: redisAvailable ? 'Redis' : 'MemoryStore',
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    proxy: config.proxy,
    env: process.env.NODE_ENV,
  });
  
  return session(config);
}

// Export du middleware de session (version async à utiliser dans index.ts)
let sessionMiddleware: any = null;

export async function initializeSession() {
  sessionMiddleware = await createSessionMiddleware();
  return sessionMiddleware;
}

export function getSessionMiddleware() {
  if (!sessionMiddleware) {
    throw new Error('Session middleware not initialized. Call initializeSession() first.');
  }
  return sessionMiddleware;
}

export { redisAvailable };