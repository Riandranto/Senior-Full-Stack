import session from 'express-session';
import { redisStore } from './redis';

export const sessionConfig = {
  store: redisStore,
  secret: process.env.SESSION_SECRET || 'super-secret-key',
  resave: false,
  saveUninitialized: false,
  name: 'farady.sid', // Changé de 'connect.sid' par défaut
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 heures
    httpOnly: true,

    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    domain: process.env.NODE_ENV === 'production' ? process.env.DOMAIN : undefined
  },
  rolling: true, // Renouvelle le cookie à chaque requête
  proxy: process.env.NODE_ENV === 'production' // Trust proxy en production
};