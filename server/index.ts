import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
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

// Fonction pour obtenir l'IP locale
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
    
    // Priorité aux IPs 192.168.1.x
    const preferred = results.find(r => r.address.startsWith('192.168.1.'));
    if (preferred) {
      console.log(`✅ IP sélectionnée: ${preferred.address} (${preferred.name})`);
      return preferred.address;
    }
    
    // Sinon prendre la première IP externe
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

// Configuration CORS simplifiée et plus permissive
// server/index.ts - Remettez ceci AVANT de l'utiliser
const corsOptions = {
  origin: function(origin, callback) {
    callback(null, true); // Tout autoriser pour l'instant
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'X-Requested-With', 'Cookie'],
  exposedHeaders: ['set-cookie'],
};


// Appliquer CORS à toutes les routes
app.use(cors(corsOptions));

// Configuration de la session - CORRIGÉE
app.use(
  session({
    cookie: { 
      maxAge: 86400000, // 24 heures
      secure: false, // Important: false en développement
      httpOnly: true,
      sameSite: 'none', // Changé de 'lax' à 'none' pour cross-origin
      path: '/',
    },
    store: new MemoryStore({
      checkPeriod: 86400000, // Nettoyer les sessions expirées toutes les 24h
    }),
    resave: false,
    saveUninitialized: false,
    secret: process.env.SESSION_SECRET || "super-secret-key-change-in-production",
    name: 'farady.sid', // Nom explicite pour le cookie
    rolling: true, // Renouveler le cookie à chaque requête
    proxy: true, // Important pour les requêtes proxy/load balancer
  })
);

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
    
    console.log(`⚠️ IMPORTANT: Utilisez cette IP dans votre app mobile: ${localIP}`);
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