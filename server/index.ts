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
    limit: '20mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: '20mb' }));

// Configuration CORS - CORRIGÉE
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
    // En développement, accepter toutes les origines
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    // En production, vérifier l'origine
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
}));

// Middleware de logging des requêtes
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

let sessionConfigured = false;

async function setupSession() {
  const sessionStore = await getSessionStore();
  
  // Configuration CORRECTE pour Railway
  const sessionConfig = {
    store: sessionStore,
    secret: process.env.SESSION_SECRET || "super-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    name: 'farady.sid',
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 jours
      httpOnly: true,
      secure: true, // Toujours true en production (HTTPS)
      sameSite: 'none' as const, // CRUCIAL pour cross-origin
      domain: undefined, // Ne pas définir de domaine
      path: '/',
    },
    rolling: true,
    proxy: true, // CRUCIAL derrière Railway
  };
  
  console.log('📦 Session config:', {
    store: redisAvailable ? 'Redis' : 'MemoryStore',
    secure: sessionConfig.cookie.secure,
    sameSite: sessionConfig.cookie.sameSite,
    proxy: sessionConfig.proxy,
    env: process.env.NODE_ENV,
    railway: !!process.env.RAILWAY_ENVIRONMENT
  });
  
  app.use(session(sessionConfig));
  sessionConfigured = true;
  console.log('✅ Session middleware configured');
}

// ========== ENDPOINTS DE DEBUG ==========

app.get('/api/test', (req, res) => {
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

app.get('/api/debug/cookies', (req, res) => {
  console.log('🍪 Cookies received:', req.headers.cookie);
  console.log('🍪 Session:', req.session);
  
  res.json({
    cookies: req.headers.cookie,
    sessionId: req.session?.id,
    userId: req.session?.userId,
    sessionExists: !!req.session,
  });
});

// ========== DÉMARRAGE DU SERVEUR ==========

(async () => {
  try {
    // 1. Configurer les sessions
    await setupSession();
    
    // 2. Enregistrer les routes
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