import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes.js";
import { serveStatic } from "./static.js";
import { createServer } from "http";
import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import os from "os";
import cors from 'cors';
import { initializeSession, redisAvailable as sessionRedisAvailable } from "./services/session.js";
import { logger, createContextLogger } from "./utils/logger.js";
import helmet from "helmet";
import { errorHandler } from "./middleware/error-handler.js";
import { requestId } from "./middleware/request-id.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========== VALIDATION ENVIRONNEMENT ==========
if (process.env.NODE_ENV === 'production') {
  const requiredEnv = ['SESSION_SECRET', 'DATABASE_URL'];
  for (const env of requiredEnv) {
    if (!process.env[env]) {
      logger.fatal(`Missing ${env} in environment`);
      process.exit(1);
    }
  }
}
if (process.env.SESSION_SECRET === 'farady-secret-key-change-in-production') {
  logger.warn('⚠️ Using default session secret - change it in production!');
}

// ========== SENTRY INITIALIZATION ==========
let Sentry: any = null;
if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
  try {
    const sentryModule = await import('@sentry/node');
    Sentry = sentryModule;
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.Express({ app }),
      ],
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
      profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),
      environment: process.env.NODE_ENV,
      release: `ride-mada@${process.env.npm_package_version || '1.0.0'}`,
      beforeSend(event: any) {
        if (process.env.NODE_ENV === 'development') return null;
        if (event.request?.data) {
          delete event.request.data.password;
          delete event.request.data.token;
        }
        return event;
      },
    });
    logger.info('✅ Sentry initialized');
  } catch (err: any) {
    logger.warn('Sentry init failed:', err.message);
  }
}

// Import Redis avec fallback
let initializeRedis: () => Promise<boolean> = async () => false;
let redisStore: any = null;
let redisAvailable = false;

try {
  const redisModule = await import("./services/redis.js");
  initializeRedis = redisModule.initializeRedis || (async () => false);
  redisStore = redisModule.redisStore || null;
  logger.info('✅ Redis module loaded');
} catch (err: any) {
  if (err.code === 'ERR_MODULE_NOT_FOUND') {
    logger.info('ℹ️ Redis module not found, using MemoryStore only');
  } else {
    logger.warn('⚠️ Redis module import failed:', err.message);
  }
}

const app = express();
let httpServer: any;
let httpsServer: any;

app.set('trust proxy', 1);

const isProduction = process.env.NODE_ENV === 'production';
const MemoryStore = createMemoryStore(session);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

declare module "express-session" {
  interface SessionData {
    userId: number;
    role: string;
  }
}

function getLocalIP(): string {
  try {
    const nets = os.networkInterfaces();
    const results: { address: string, name: string, family: string }[] = [];
    logger.info('\n📡 Interfaces réseau disponibles:');
    logger.info('='.repeat(50));
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4') {
          const type = net.internal ? '🔒 Interne' : '🌍 Externe';
          logger.info(`${type} - ${name}: ${net.address}`);
          if (!net.internal) {
            results.push({ address: net.address, name: name, family: net.family });
          }
        }
      }
    }
    logger.info('='.repeat(50) + '\n');
    const preferred = results.find(r => r.address.startsWith('192.168.1.'));
    if (preferred) {
      logger.info(`✅ IP sélectionnée: ${preferred.address} (${preferred.name})`);
      return preferred.address;
    }
    if (results.length > 0) {
      logger.info(`⚠️ IP sélectionnée: ${results[0].address} (${results[0].name})`);
      return results[0].address;
    }
  } catch (error) {
    logger.error('Erreur:', error);
  }
  return '192.168.1.101';
}

// ========== SECURITY MIDDLEWARES ==========

// Helmet avec CSP autorisant Google Fonts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", ...(isProduction ? [] : ['ws://localhost:*'])],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: isProduction ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0');
  next();
});

// Session unifiée
let sessionMiddleware: any;
try {
  sessionMiddleware = await initializeSession();
} catch (err) {
  logger.error('Failed to initialize session, falling back to MemoryStore');
  sessionMiddleware = session({
    name: 'farady.sid',
    secret: process.env.SESSION_SECRET || 'farady-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    store: new MemoryStore({ checkPeriod: 86400000 }),
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
    }
  });
}
app.use(sessionMiddleware);

app.use("/images", express.static(path.join(__dirname, "../public/images")));
logger.info('✅ Session middleware configured');

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 1000 : 300,
  message: 'Trop de requêtes',
  skip: (req) => process.env.NODE_ENV === 'development' || req.path === '/api/ws' || req.path.includes('/api/rides/'),
  keyGenerator: (req) => req.ip || req.id,
});
app.use('/api', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 100 : 5,
  message: 'Trop de tentatives de connexion, veuillez réessayer dans 15 minutes.',
  skipSuccessfulRequests: true,
  skip: (req) => process.env.NODE_ENV === 'development'
});

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: false, limit: '20mb' }));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 
  'http://localhost:5173,http://localhost:5000,https://senior-full-stack.onrender.com'
).split(',');
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || !isProduction) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

if (isProduction) {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https' && process.env.ENABLE_HTTPS !== 'false') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

app.use(requestId());
app.use((req, res, next) => {
  const startTime = Date.now();
  const reqLogger = createContextLogger({
    reqId: req.id,
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  req.logger = reqLogger;
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    reqLogger[level](`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    if (isProduction && duration > 1000) {
      reqLogger.warn(`Slow request detected`, { duration, statusCode: res.statusCode });
    }
  });
  next();
});

if (!isProduction) {
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      logger.debug('Session Debug:', {
        path: req.path,
        sessionID: req.sessionID,
        hasSession: !!req.session,
        userId: req.session?.userId ? 'present' : 'absent',
      });
    }
    next();
  });
}

// Endpoints
app.get('/api/test', (req, res) => {
  logger.info('Test endpoint called');
  res.json({ 
    message: 'Backend is working!',
    time: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    sessionStore: sessionRedisAvailable ? 'Redis' : 'MemoryStore',
  });
});
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok",
    sessionStore: sessionRedisAvailable ? 'Redis' : 'MemoryStore',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
app.get('/api/metrics', (req, res) => {
  res.json({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    sessionStore: sessionRedisAvailable ? 'Redis' : 'MemoryStore',
    environment: process.env.NODE_ENV,
    timestamp: Date.now()
  });
});
app.get('/api/debug/static', (req, res) => {
  const distPath = path.join(process.cwd(), 'dist');
  let files: string[] = [];
  if (fs.existsSync(distPath)) {
    files = fs.readdirSync(distPath);
  }
  res.json({
    cwd: process.cwd(),
    distPath,
    exists: fs.existsSync(distPath),
    files,
    nodeEnv: process.env.NODE_ENV,
  });
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);

if (!isProduction) {
  app.get('/api/debug/session-state', (req, res) => {
    res.json({
      sessionID: req.sessionID,
      userId: req.session?.userId,
      role: req.session?.role,
      hasSession: !!req.session?.userId,
      environment: process.env.NODE_ENV,
      sessionStore: sessionRedisAvailable ? 'Redis' : 'MemoryStore',
    });
  });
  app.post('/api/debug/set-session', (req, res) => {
    req.session.userId = 1;
    req.session.role = 'PASSENGER';
    req.session.save((err) => {
      if (err) {
        logger.error('Session save error:', err);
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Session set', sessionId: req.session.id, userId: req.session.userId });
    });
  });
  app.get('/api/debug/check-session', (req, res) => {
    res.json({
      sessionId: req.session.id,
      userId: req.session.userId,
      role: req.session.role,
      hasSession: !!req.session.userId
    });
  });
}

// ========== ROUTES PRINCIPALES ==========
async function startServer() {
  try {
    const port = parseInt(process.env.PORT || "10000", 10);
    const host = "0.0.0.0";
    httpServer = createServer(app);
    await registerRoutes(httpServer, app);
    startHttpServer(port, host);
    
    // Gestion des erreurs de l'application (après les routes)
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      logger.error('Error:', err);
      res.status(500).json({ message: "Erreur interne" });
    });

    // ========== FICHIERS STATIQUES CORRIGÉS ==========
    // Le build Vite place les fichiers dans le dossier 'dist' (pas 'dist/public')
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      logger.info(`📁 Serving static files from ${distPath}`);
      app.use(express.static(distPath));
      // Pour toutes les routes non API, renvoyer index.html (SPA)
      app.use((req, res, next) => {
        if (req.path.startsWith('/api')) return next();
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      logger.warn(`⚠️ Dist folder not found at ${distPath}, static files may not be served correctly.`);
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

function startHttpServer(port: number, host: string) {
  httpServer.listen(port, host, () => {
    const localIP = getLocalIP();
    logger.info('\n' + '='.repeat(60));
    logger.info('🚀 SERVER STARTED SUCCESSFULLY');
    logger.info('='.repeat(60));
    logger.info(`📡 Local access:    http://localhost:${port}`);
    logger.info(`🌍 Network access:  http://${localIP}:${port}`);
    logger.info(`🗄️  Session store:   ${sessionRedisAvailable ? 'Redis ✅' : 'MemoryStore ⚠️'}`);
    logger.info(`🔒 HTTPS:           ${isProduction ? 'Disabled' : 'Disabled (development)'}`);
    logger.info(`📊 Metrics:         http://localhost:${port}/api/metrics`);
    logger.info('='.repeat(60) + '\n');
    logger.info('📝 Test avec:');
    logger.info(`   curl http://localhost:${port}/api/test`);
    logger.info(`   curl http://localhost:${port}/api/health`);
    logger.info(`   curl http://localhost:${port}/api/metrics`);
    if (!isProduction) {
      logger.info(`   curl http://localhost:${port}/api/debug/session-state`);
    }
    logger.info(`   curl http://localhost:${port}/api/debug/static`);
  });

  httpServer.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`Port ${port} is already in use!`);
      process.exit(1);
    } else {
      logger.error('Server error:', error);
      process.exit(1);
    }
  });
}

const shutdown = async (signal: string) => {
  logger.info(`${signal} received, closing server...`);
  if (httpServer) {
    httpServer.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
  setTimeout(() => {
    logger.error('Forced shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startServer();