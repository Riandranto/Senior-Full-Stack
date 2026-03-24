import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { registerRoutes } from "./routes.js";
import { serveStatic } from "./static.js";
import { createServer } from "http";
import os from "os";
import cors from 'cors';

// Import Redis avec fallback
let initializeRedis: () => Promise<boolean> = async () => false;
let redisStore: any = null;
let redisAvailable = false;

// Essayer d'importer Redis, mais ignorer si erreur
try {
  const redisModule = await import("./lib/redis.js");
  initializeRedis = redisModule.initializeRedis || (async () => false);
  redisStore = redisModule.redisStore || null;
  console.log('✅ Redis module loaded');
} catch (err: any) {
  if (err.code === 'ERR_MODULE_NOT_FOUND') {
    console.log('ℹ️ Redis module not found, using MemoryStore only');
  } else {
    console.warn('⚠️ Redis module import failed:', err.message);
  }
}

const app = express();
const httpServer = createServer(app);
const MemoryStore = createMemoryStore(session);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Extension du type Session
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
    
    console.log('\n📡 Interfaces réseau disponibles:');
    console.log('='.repeat(50));
    
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4') {
          const type = net.internal ? '🔒 Interne' : '🌍 Externe';
          console.log(`${type} - ${name}: ${net.address}`);
          if (!net.internal) {
            results.push({
              address: net.address,
              name: name,
              family: net.family
            });
          }
        }
      }
    }
    console.log('='.repeat(50) + '\n');
    
    const preferred = results.find(r => r.address.startsWith('192.168.1.'));
    if (preferred) {
      console.log(`✅ IP sélectionnée: ${preferred.address} (${preferred.name})`);
      return preferred.address;
    }
    
    if (results.length > 0) {
      console.log(`⚠️ IP sélectionnée: ${results[0].address} (${results[0].name})`);
      return results[0].address;
    }
    
  } catch (error) {
    console.error('Erreur:', error);
  }
  
  return '192.168.1.101';
}

// ========== MIDDLEWARES AVANT TOUT ==========

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Configuration CORS - DOIT ÊTRE AVANT LES ROUTES
const allowedOrigins = [
  'https://ride-mada-mg.up.railway.app',
  'capacitor://localhost',
  'http://localhost',
  'http://localhost:5000',
  'http://localhost:5173',
  'http://127.0.0.1:5000',
  'http://127.0.0.1:5173',
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
}));

// Middleware de logging des requêtes (AVANT LES ROUTES)
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      log(logLine);
    }
  });

  next();
});

// ========== CONFIGURATION DE LA SESSION ==========

const isProduction = process.env.NODE_ENV === 'production';

// Fonction pour initialiser le store de session
async function getSessionStore() {
  let store;
  
  if (redisStore) {
    try {
      console.log('🔄 Tentative de connexion à Redis...');
      const redisInitialized = await initializeRedis();
      if (redisInitialized) {
        store = redisStore;
        redisAvailable = true;
        console.log('✅ Redis session store initialized');
      } else {
        console.warn('⚠️ Redis initialization failed, falling back to MemoryStore');
      }
    } catch (err) {
      console.error('❌ Redis connection error:', err);
      console.warn('⚠️ Falling back to MemoryStore');
    }
  }
  
  if (!store) {
    console.log('📦 Using MemoryStore for sessions');
    store = new MemoryStore({
      checkPeriod: 86400000,
    });
  }
  
  return store;
}

// Configuration de la session - DOIT ÊTRE AVANT LES ROUTES
let sessionConfigured = false;

async function setupSession() {
  const sessionStore = await getSessionStore();
  
  const sessionConfig = {
    store: sessionStore,
    secret: process.env.SESSION_SECRET || "super-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    name: 'farady.sid',
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      secure: isProduction ? true : false,
      httpOnly: true,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
    },
    rolling: true,
    proxy: isProduction,
  };
  
  console.log('📦 Session config:', {
    store: redisAvailable ? 'Redis' : 'MemoryStore',
    secure: sessionConfig.cookie.secure,
    sameSite: sessionConfig.cookie.sameSite,
    proxy: sessionConfig.proxy,
    env: process.env.NODE_ENV,
  });
  
  app.use(session(sessionConfig));
  sessionConfigured = true;
  console.log('✅ Session middleware configured');
}

// ========== ENDPOINTS DE DEBUG (AVANT LES ROUTES API) ==========

// Endpoint de test amélioré
app.get('/api/test', (req, res) => {
  console.log('🔧 Test endpoint called');
  console.log('📦 Session ID:', req.session?.id);
  console.log('📦 Session data:', req.session);
  
  res.json({ 
    message: 'Backend is working!',
    time: new Date().toISOString(),
    sessionId: req.session?.id,
    userId: req.session?.userId,
    environment: process.env.NODE_ENV,
    sessionStore: redisAvailable ? 'Redis' : 'MemoryStore',
    sessionConfigured: sessionConfigured
  });
});

app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok",
    sessionStore: redisAvailable ? 'Redis' : 'MemoryStore',
    sessionConfigured: sessionConfigured,
    timestamp: new Date().toISOString()
  });
});

// Middleware de debug des sessions (AVANT LES ROUTES)
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log('📦 Session Debug:', {
      path: req.path,
      sessionID: req.sessionID,
      hasSession: !!req.session,
      userId: req.session?.userId,
      role: req.session?.role,
    });
  }
  next();
});

// Endpoint de debug pour la session
app.get('/api/debug/session-state', (req, res) => {
  res.json({
    sessionID: req.sessionID,
    userId: req.session?.userId,
    role: req.session?.role,
    cookie: req.session?.cookie,
    cookieHeader: req.headers['cookie'],
    hasSession: !!req.session?.userId,
    environment: process.env.NODE_ENV,
    sessionStore: redisAvailable ? 'Redis' : 'MemoryStore',
    sessionConfigured: sessionConfigured,
    timestamp: new Date().toISOString()
  });
});

// Endpoint pour voir les chemins (debug)
app.get('/api/debug/paths', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  
  const currentDir = process.cwd();
  const distPublic = path.join(currentDir, 'dist', 'public');
  
  let files = {};
  if (fs.existsSync(distPublic)) {
    files = fs.readdirSync(distPublic).reduce((acc, file) => {
      if (file === 'assets') {
        acc[file] = fs.readdirSync(path.join(distPublic, file));
      } else {
        acc[file] = true;
      }
      return acc;
    }, {});
  }
  
  res.json({
    currentDirectory: currentDir,
    distPublicExists: fs.existsSync(distPublic),
    distPublicContent: files,
    env: process.env.NODE_ENV,
    sessionStore: redisAvailable ? 'Redis' : 'MemoryStore'
  });
});

// ========== DÉMARRAGE DU SERVEUR ==========

(async () => {
  try {
    // 1. Configurer les sessions
    await setupSession();
    
    // 2. Enregistrer les routes (qui utilisent maintenant la session)
    await registerRoutes(httpServer, app);
    console.log('✅ Routes registered');

    // 3. Gestion des erreurs
    app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      console.error("❌ Internal Server Error:", err);

      if (res.headersSent) {
        return next(err);
      }

      return res.status(status).json({ message });
    });

    // 4. Servir les fichiers statiques en production
    if (process.env.NODE_ENV === "production") {
      serveStatic(app);
      console.log('✅ Static files configured');
    } else {
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
      console.log('✅ Vite dev server configured');
    }

    const port = parseInt(process.env.PORT || "5000", 10);
    const host = "0.0.0.0";

    httpServer.listen(port, host, () => {
      const localIP = getLocalIP();
      console.log('\n' + '='.repeat(60));
      console.log('🚀 SERVER STARTED SUCCESSFULLY');
      console.log('='.repeat(60));
      console.log(`📡 Local access:    http://localhost:${port}`);
      console.log(`🌍 Network access:  http://${localIP}:${port}`);
      console.log(`📱 For mobile app:  http://${localIP}:${port}`);
      console.log(`🗄️  Session store:   ${redisAvailable ? 'Redis ✅' : 'MemoryStore ⚠️'}`);
      console.log('='.repeat(60) + '\n');
      
      console.log('📝 Test avec:');
      console.log(`   curl http://localhost:${port}/api/test`);
      console.log(`   curl http://localhost:${port}/api/health`);
      console.log(`   curl http://localhost:${port}/api/debug/session-state\n`);
    });

    httpServer.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} is already in use!`);
        process.exit(1);
      } else {
        console.error('❌ Server error:', error);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
})();