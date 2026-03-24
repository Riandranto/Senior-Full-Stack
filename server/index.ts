import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { registerRoutes } from "./routes.js";
import { serveStatic } from "./static.js";
import { createServer } from "http";
import os from "os";
import cors from 'cors';

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

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

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

// En développement, accepter toutes les origines
if (process.env.NODE_ENV !== 'production') {
  const allowedOrigins = [];
}

app.use(cors({
  origin: true,
  credentials: true,
}));


// Configuration de la session - CORRIGÉE
const isProduction = process.env.NODE_ENV === 'production';

const sessionConfig = {
  store: new MemoryStore({
    checkPeriod: 86400000,
  }),
  secret: process.env.SESSION_SECRET || "super-secret-key-change-in-production",
  resave: false,
  saveUninitialized: false,
  name: 'farady.sid',
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    secure: true, // 🔥 FORCER TRUE en prod (Railway = HTTPS)
    httpOnly: true,
    sameSite: 'none', // 🔥 obligatoire cross-origin
    path: '/',
  },
  rolling: true,
  proxy: isProduction,
};

console.log('📦 Session config:', {
  secure: sessionConfig.cookie.secure,
  sameSite: sessionConfig.cookie.sameSite,
  proxy: sessionConfig.proxy,
  env: process.env.NODE_ENV,
  resave: sessionConfig.resave,
  saveUninitialized: sessionConfig.saveUninitialized,
});

app.use(session(sessionConfig));

// Middleware pour logger les requêtes
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// Middleware de logging des requêtes
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

// Endpoint de test amélioré
app.get('/api/test', (req, res) => {
  console.log('🔧 Test endpoint called');
  console.log('📦 Session ID:', req.session.id);
  console.log('📦 Session data:', req.session);
  console.log('📦 Headers:', req.headers);
  console.log('📦 Cookies:', req.headers.cookie);
  
  res.json({ 
    message: 'Backend is working!',
    time: new Date().toISOString(),
    sessionId: req.session.id,
    userId: req.session.userId,
    environment: process.env.NODE_ENV,
    cors: 'enabled',
    ip: getLocalIP()
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Middleware de debug des sessions
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log('📦 Session Debug:', {
      path: req.path,
      sessionID: req.sessionID,
      userId: req.session.userId,
      role: req.session.role,
      cookie: req.headers.cookie,
    });
  }
  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("❌ Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
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
    console.log('='.repeat(60) + '\n');
    
    console.log('📝 Test avec:');
    console.log(`   curl http://localhost:${port}/api/test`);
    console.log(`   curl http://${localIP}:${port}/api/test\n`);
  });

  httpServer.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ Port ${port} is already in use!`);
      console.error(`💡 Solution: Change the port in .env file or kill the process using port ${port}`);
    } else {
      console.error('❌ Server error:', error);
    }
    process.exit(1);
  });

})();