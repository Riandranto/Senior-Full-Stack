// server/routes.ts - VERSION COMPLÈTE

import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { api } from "@shared/routes";
import { 
  users, driverProfiles, rides, offers, appConfig, driverLocations, driverDocuments, customPlaces, 
  advertisements, adStats, isWithinRange, calculateDistance, WS_EVENTS, chatMessages,
  passengerDocuments, bookings, bookingOffers, emailOtps
} from "@shared/schema";
import { z } from "zod";
import { eq, and, or, sql } from "drizzle-orm";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import express from "express";
import path from "path";
import fs from "fs";

// ==================== OTP SERVICES SIMPLIFIÉS ====================

// Générer un OTP à 6 chiffres
function generateOtp(): string {
  return Math.floor(100000 + Math.random() 900000).toString();
}

// Stockage temporaire en mémoire pour les OTP (pour les tests)
declare global {
  var otpStore: Map<string, { otp: string; expiresAt: number }>;
}
if (!global.otpStore) {
  global.otpStore = new Map();
}

// Fonctions OTP simplifiées
async function savePhoneOtp(phone: string, otp: string): Promise<void> {
  global.otpStore.set(phone, { otp, expiresAt: Date.now() + 5  60  1000 });
  console.log(`✅ OTP saved for ${phone}: ${otp}`);
}

async function verifyPhoneOtp(phone: string, otp: string): Promise<boolean> {
  const stored = global.otpStore.get(phone);
  if (!stored) return false;
  if (stored.otp !== otp) return false;
  if (Date.now() > stored.expiresAt) return false;
  global.otpStore.delete(phone);
  return true;
}

async function saveEmailOtp(email: string, otp: string): Promise<void> {
  global.otpStore.set(`email_${email}`, { otp, expiresAt: Date.now() + 5  60  1000 });
  console.log(`✅ Email OTP saved for ${email}: ${otp}`);
}

async function verifyEmailOtp(email: string, otp: string): Promise<boolean> {
  const stored = global.otpStore.get(`email_${email}`);
  if (!stored) return false;
  if (stored.otp !== otp) return false;
  if (Date.now() > stored.expiresAt) return false;
  global.otpStore.delete(`email_${email}`);
  return true;
}

async function sendSmsOtp(phone: string, otp: string): Promise<boolean> {
  console.log(`📱 [SMS] Code OTP pour ${phone}: ${otp}`);
  return true;
}

async function sendEmailOtp(email: string, otp: string, language: string = 'fr'): Promise<boolean> {
  console.log(`📧 [EMAIL] Code OTP pour ${email}: ${otp}`);
  return true;
}

// ==================== CONFIGURATION MULTER ====================

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s/g, '_')}`),
});

const upload = multer({ 
  storage: uploadStorage, 
  limits: { fileSize: 10  1024  1024 } 
});

const adUpload = multer({
  storage: uploadStorage,
  limits: { fileSize: 10  1024  1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images sont acceptées (JPEG, PNG, GIF, WEBP)'));
    }
  }
});

declare module "express-session" {
  interface SessionData {
    userId: number;
    role: string;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ==================== MIDDLEWARES ====================
  
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  app.use((req, res, next) => {
    if (!req.session) {
      console.error('❌ Session not initialized for request:', req.path);
      return res.status(500).json({ message: "Session not initialized" });
    }
    next();
  });

  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Non authentifié" });
    }
    next();
  };

  const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.userId || req.session?.role !== 'ADMIN') {
      return res.status(403).json({ message: "Accès refusé" });
    }
    next();
  };

  // ==================== WEBSOCKET ====================
  
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    if (url.pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  const clients = new Map<number, WebSocket>();

  wss.on('connection', (ws, req) => {
    let userId: number | null = null;
    
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'auth' && data.payload?.userId) {
          userId = data.payload.userId;
          clients.set(userId!, ws);
          console.log(`✅ WebSocket authenticated for user ${userId}`);
        }
        
        if (data.type === 'CHAT_MESSAGE' && userId) {
          const { rideId, message: msg, fromName, toUserId } = data.payload;
          
          try {
            const [savedMessage] = await db.insert(chatMessages).values({
              rideId,
              senderId: userId,          
              receiverId: toUserId || 0,
              message: msg.trim(),
              isRead: false,
            }).returning();
            
            const target = clients.get(toUserId);
            if (target && target.readyState === WebSocket.OPEN) {
              target.send(JSON.stringify({
                type: 'CHAT_MESSAGE',
                payload: {
                  id: savedMessage.id,
                  rideId,
                  from: userId,
                  fromName: fromName || 'Utilisateur',
                  message: msg,
                  timestamp: savedMessage.createdAt.toISOString()
                }
              }));
            }
            
            ws.send(JSON.stringify({
              type: 'CHAT_MESSAGE_SENT',
              payload: { id: savedMessage.id, success: true }
            }));
          } catch (error) {
            console.error('❌ Error saving chat message:', error);
            ws.send(JSON.stringify({
              type: 'CHAT_MESSAGE_ERROR',
              payload: { error: 'Failed to save message' }
            }));
          }
        }
      } catch (e) {
        console.error("❌ WS error:", e);
      }
    });
  
    ws.on('close', () => {
      if (userId) {
        clients.delete(userId);
        console.log(`🔌 WebSocket closed for user ${userId}`);
      }
    });
  });

  const broadcastToDrivers = async (message: any) => {
    const drivers = await storage.getAllDrivers();
    const onlineDrivers = drivers.filter(d => d.online);
    for (const d of onlineDrivers) {
      const ws = clients.get(d.userId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    }
  };

  const sendToUser = (userId: number, message: any) => {
    const ws = clients.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  };

  // ==================== DEBUG ROUTES ====================
  
  app.get('/api/debug/env', (req, res) => {
    res.json({
      nodeEnv: process.env.NODE_ENV,
      hasSessionSecret: !!process.env.SESSION_SECRET,
      sessionId: req.sessionID,
      session: req.session
    });
  });

  app.get('/api/debug/db', async (req, res) => {
    try {
      const result = await db.execute(sql`SELECT NOW()`);
      const userCount = await db.select({ count: sql<number>`count(*)` }).from(users);
      
      res.json({
        connected: true,
        timestamp: result.rows[0],
        userCount: userCount[0].count,
        nodeEnv: process.env.NODE_ENV
      });
    } catch (error) {
      console.error('DB connection error:', error);
      res.status(500).json({ 
        connected: false, 
        error: String(error) 
      });
    }
  });

  app.get('/api/debug/session', (req, res) => {
    res.json({
      sessionId: req.sessionID,
      userId: req.session?.userId,
      role: req.session?.role,
      hasSession: !!req.session?.userId,
      cookie: req.headers.cookie
    });
  });

  app.get('/api/debug/session-state', (req, res) => {
    res.json({
      sessionID: req.sessionID,
      userId: req.session.userId,
      role: req.session.role,
      cookie: req.session.cookie,
      cookieHeader: req.headers['cookie'],
      hasSession: !!req.session.userId,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    });
  });

  app.get('/api/debug/paths', (req, res) => {
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
    });
  });

  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok",
      timestamp: new Date().toISOString()
    });
  });

  app.get('/api/test', (req, res) => {
    res.json({ 
      message: 'Backend is working!',
      time: new Date().toISOString(),
      sessionId: req.session?.id,
      userId: req.session?.userId,
      environment: process.env.NODE_ENV,
    });
  });

  app.get('/api/metrics', (req, res) => {
    res.json({
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      environment: process.env.NODE_ENV,
      timestamp: Date.now()
    });
  });

  // ==================== AUTH ROUTES ====================

  // Route OTP TÉLÉPHONE - request
  app.post(api.auth.requestOtp.path, async (req, res) => {
    try {
      console.log('📞 requestOtp called');
      const { phone } = req.body;
      
      if (!phone) {
        return res.status(400).json({ message: "Numéro requis" });
      }
      
      const cleanPhone = phone.replace(/[\s-]/g, '');
      const otp = generateOtp();
      console.log(`🎲 OTP généré pour ${cleanPhone}: ${otp}`);
      
      await savePhoneOtp(cleanPhone, otp);
      await sendSmsOtp(cleanPhone, otp);
      
      // 🔥 Toujours retourner l'OTP pour les tests (affichage dans le toast)
      return res.json({ 
        message: "Code envoyé", 
        expiresIn: 300,
        devOtp: otp
      });
      
    } catch (error) {
      console.error('requestOtp error:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });
  
  // Route OTP TÉLÉPHONE - verify
  app.post('/api/auth/verify-otp', async (req, res) => {
    try {
      const { phone, otp } = req.body;
      
      console.log(`🔐 Vérification OTP pour ${phone} avec code: ${otp}`);
      
      if (!phone || !otp) {
        return res.status(400).json({ message: "Numéro et code requis" });
      }
      
      const cleanPhone = phone.replace(/[\s-]/g, '');
      let isValid = false;
      
      // Code universel 123456 pour les tests
      if (otp === "123456") {
        console.log(`🔓 Code universel 123456 accepté pour ${cleanPhone}`);
        isValid = true;
      } else {
        isValid = await verifyPhoneOtp(cleanPhone, otp);
      }
      
      if (!isValid) {
        console.log(`❌ Code invalide pour ${cleanPhone}`);
        return res.status(401).json({ message: "Code invalide ou expiré" });
      }
      
      let user = await storage.getUserByPhone(cleanPhone);
      if (!user) {
        user = await storage.createUser({ 
          phone: cleanPhone, 
          name: `User_${cleanPhone.slice(-4)}`, 
          role: "PASSENGER" 
        });
        console.log(`✅ Nouvel utilisateur créé: ${user.id}`);
      }
      
      if (user.isBlocked) {
        return res.status(403).json({ message: "Compte bloqué. Contactez l'administrateur." });
      }
      
      req.session.userId = user.id;
      req.session.role = user.role;
      
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).json({ message: "Erreur session" });
        }
        
        console.log(`✅ Utilisateur ${user.id} connecté`);
        
        res.json({ 
          user: {
            id: user.id,
            name: user.name,
            phone: user.phone,
            email: user.email,
            role: user.role,
            language: user.language,
            isApproved: user.isApproved,
            isBlocked: user.isBlocked,
          }, 
          success: true 
        });
      });
      
    } catch (error) {
      console.error('verifyOtp error:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Route OTP EMAIL - request
  app.post('/api/auth/request-email-otp', async (req, res) => {
    try {
      console.log('📧 Email OTP request received:', req.body);
      const { email, language = 'fr' } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email requis" });
      }
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Format d'email invalide" });
      }
      
      const otp = generateOtp();
      console.log(`🎲 OTP email généré pour ${email}: ${otp}`);
      
      await saveEmailOtp(email, otp);
      await sendEmailOtp(email, otp, language);
      
      // 🔥 Toujours retourner l'OTP pour les tests (affichage dans le toast)
      return res.json({ 
        message: "Code envoyé", 
        expiresIn: 300,
        devOtp: otp
      });
      
    } catch (error) {
      console.error('requestEmailOtp error:', error);
      res.status(500).json({ 
        message: "Erreur serveur",
        devOtp: "123456"
      });
    }
  });
  
  // Route OTP EMAIL - verify
  app.post('/api/auth/verify-email-otp', async (req, res) => {
    try {
      console.log('🔐 Email OTP verification request:', { email: req.body.email });
      const { email, otp } = req.body;
      
      if (!email || !otp) {
        return res.status(400).json({ message: "Email et code requis" });
      }
      
      let isValid = false;
      
      // Code universel 123456 pour les tests
      if (otp === "123456") {
        console.log(`🔓 Code universel 123456 accepté pour ${email}`);
        isValid = true;
      } else {
        isValid = await verifyEmailOtp(email, otp);
      }
      
      if (!isValid) {
        console.log(`❌ Invalid OTP for ${email}`);
        return res.status(401).json({ message: "Code invalide ou expiré" });
      }
      
      let user = await storage.getUserByEmail(email);
      
      if (!user) {
        const tempName = email.split('@')[0];
        let finalName = tempName;
        let counter = 1;
        
        let existingUser = await storage.getUserByName(finalName);
        while (existingUser) {
          finalName = `${tempName}${counter}`;
          existingUser = await storage.getUserByName(finalName);
          counter++;
        }
        
        user = await storage.createUser({ 
          email,
          phone: `EMAIL_${Date.now()}`,
          name: finalName,
          role: "PASSENGER",
          language: "fr"
        });
        
        console.log(`✅ Nouvel utilisateur créé: ${user.id}`);
      }
      
      if (user.isBlocked) {
        return res.status(403).json({ message: "Compte bloqué. Contactez l'administrateur." });
      }
      
      req.session.userId = user.id;
      req.session.role = user.role;
      
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).json({ message: "Erreur session" });
        }
        
        console.log(`✅ Utilisateur ${user.id} connecté via email`);
        
        res.json({ 
          user: {
            id: user.id,
            name: user.name,
            phone: user.phone,
            email: user.email,
            role: user.role,
            language: user.language,
            isApproved: user.isApproved,
            isBlocked: user.isBlocked,
          }, 
          success: true 
        });
      });
      
    } catch (error) {
      console.error('verifyEmailOtp error:', error);
      res.status(500).json({ 
        message: "Erreur serveur",
        error: process.env.NODE_ENV === 'development' ? String(error) : undefined
      });
    }
  });

  // Route GET /api/auth/me
  app.get(api.auth.me.path, async (req, res) => {
    console.log('👤 getMe called');
    console.log('Session ID:', req.sessionID);
    console.log('Session userId:', req.session?.userId);
    
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Non authentifié" });
    }
    
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "Utilisateur non trouvé" });
    }
    
    res.json(user);
  });
  
  // Route POST /api/auth/logout
  app.post(api.auth.logout.path, (req, res) => {
    console.log('🚪 logout called');
    
    req.session.destroy((err) => {
      if (err) {
        console.error('❌ Logout error:', err);
        return res.status(500).json({ message: "Erreur lors de la déconnexion" });
      }
      res.clearCookie('farady.sid');
      res.json({ message: "Déconnexion réussie" });
    });
  });

  // Route POST /api/auth/resend-email-otp
  app.post('/api/auth/resend-email-otp', async (req, res) => {
    try {
      const { email, language = 'fr' } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email requis" });
      }
      
      const otp = generateOtp();
      console.log(`📧 New OTP for ${email}: ${otp}`);
      
      await saveEmailOtp(email, otp);
      await sendEmailOtp(email, otp, language);
      
      return res.json({ 
        message: "Code renvoyé", 
        expiresIn: 300,
        devOtp: otp
      });
      
    } catch (error) {
      console.error('resendEmailOtp error:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // ==================== CHAT HISTORY ROUTES ====================
  
  app.get('/api/chat/history/:rideId', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Non authentifié" });
    }
    
    const rideId = parseInt(req.params.rideId);
    if (isNaN(rideId)) {
      return res.status(400).json({ message: "ID de course invalide" });
    }
    
    try {
      const messages = await db.select().from(chatMessages)
        .where(eq(chatMessages.rideId, rideId))
        .orderBy(sql`${chatMessages.createdAt} ASC`);
      
      await db.update(chatMessages)
        .set({ isRead: true })
        .where(and(
          eq(chatMessages.rideId, rideId),
          eq(chatMessages.receiverId, req.session.userId),
          eq(chatMessages.isRead, false)
        ));
      
      const formattedMessages = messages.map(msg => ({
        id: msg.id,
        rideId: msg.rideId,
        from: msg.senderId,
        to: msg.receiverId,
        message: msg.message,
        timestamp: msg.createdAt,
        isRead: msg.isRead,
        isOwn: msg.senderId === req.session.userId
      }));
      
      res.json(formattedMessages);
    } catch (error) {
      console.error('❌ Error fetching chat history:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });
  
  app.post('/api/chat/send', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Non authentifié" });
    }
    
    const { rideId, message, toUserId } = req.body;
    
    if (!rideId || !message) {
      return res.status(400).json({ message: "rideId et message requis" });
    }
    
    try {
      const [savedMessage] = await db.insert(chatMessages).values({
        rideId,
        senderId: req.session.userId,
        receiverId: toUserId || 0,
        message: message.trim(),
        isRead: false,
      }).returning();
      
      const sender = await storage.getUser(req.session.userId);
      
      if (toUserId) {
        const wsClient = clients.get(toUserId);
        if (wsClient && wsClient.readyState === WebSocket.OPEN) {
          wsClient.send(JSON.stringify({
            type: 'CHAT_MESSAGE',
            payload: {
              id: savedMessage.id,
              rideId,
              from: req.session.userId,
              fromName: sender?.name || 'Utilisateur',
              message: message.trim(),
              timestamp: savedMessage.createdAt.toISOString()
            }
          }));
        }
      }
      
      res.status(201).json({
        id: savedMessage.id,
        rideId,
        from: req.session.userId,
        message: message.trim(),
        createdAt: savedMessage.createdAt,
        isOwn: true
      });
    } catch (error) {
      console.error('❌ Error saving message:', error);
      res.status(500).json({ 
        message: "Erreur serveur", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });
  
  app.post('/api/chat/mark-read/:rideId', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Non authentifié" });
    }
    
    const rideId = parseInt(req.params.rideId);
    if (isNaN(rideId)) {
      return res.status(400).json({ message: "ID de course invalide" });
    }
    
    try {
      await db.update(chatMessages)
        .set({ isRead: true })
        .where(and(
          eq(chatMessages.rideId, rideId),
          eq(chatMessages.receiverId, req.session.userId),
          eq(chatMessages.isRead, false)
        ));
      
      res.json({ success: true });
    } catch (error) {
      console.error('❌ Error marking messages as read:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // ==================== ADVERTISEMENT ROUTES ====================

  app.get('/api/ads', async (req, res) => {
    try {
      const { screen, userRole } = req.query;
      
      let query = db.select().from(advertisements)
        .where(eq(advertisements.isActive, true))
        .orderBy(sql`${advertisements.priority} DESC`);
      
      if (screen && typeof screen === 'string') {
        query = query.where(eq(advertisements.position, screen));
      }
      
      const now = new Date();
      query = query.where(
        or(
          sql`${advertisements.startDate} IS NULL`,
          sql`${advertisements.startDate} <= ${now}`
        )
      );
      query = query.where(
        or(
          sql`${advertisements.endDate} IS NULL`,
          sql`${advertisements.endDate} >= ${now}`
        )
      );
      
      if (userRole && typeof userRole === 'string') {
        query = query.where(
          or(
            eq(advertisements.targetAudience, 'ALL'),
            eq(advertisements.targetAudience, userRole)
          )
        );
      }
      
      const ads = await query;
      
      if (req.session.userId && ads.length > 0) {
        for (const ad of ads) {
          await db.insert(adStats).values({
            adId: ad.id,
            userId: req.session.userId,
            action: 'IMPRESSION',
            screen: screen as string || 'UNKNOWN',
          }).catch(e => console.error('Failed to record impression:', e));
        }
      }
      
      res.json(ads);
    } catch (error) {
      console.error('❌ Error fetching ads:', error);
      res.status(500).json({ message: "Erreur lors du chargement des publicités" });
    }
  });

  app.get('/api/admin/ads', async (req, res) => {
    if (!req.session.userId || req.session.role !== 'ADMIN') {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    try {
      const ads = await db.select().from(advertisements).orderBy(sql`${advertisements.createdAt} DESC`);
      res.json(ads);
    } catch (error) {
      console.error('❌ Error getting ads:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post('/api/admin/ads', adUpload.single('image'), async (req, res) => {
    if (!req.session.userId || req.session.role !== 'ADMIN') {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    try {
      const { title, titleFr, description, descriptionFr, linkUrl, type, position, priority, startDate, endDate, targetAudience } = req.body;
      
      if (!title || !titleFr) {
        return res.status(400).json({ message: "Les titres sont requis" });
      }
      
      if (!req.file) {
        return res.status(400).json({ message: "L'image est requise" });
      }
      
      const imageUrl = `/uploads/${req.file.filename}`;
      
      const [newAd] = await db.insert(advertisements).values({
        title,
        titleFr,
        description: description || null,
        descriptionFr: descriptionFr || null,
        imageUrl,
        linkUrl: linkUrl || null,
        type: type || 'BANNER',
        position: position || 'HOME_TOP',
        priority: parseInt(priority) || 0,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        isActive: true,
        targetAudience: targetAudience || 'ALL',
        impressionCount: 0,
        clickCount: 0,
      }).returning();
      
      res.status(201).json(newAd);
    } catch (error) {
      console.error('❌ Error creating ad:', error);
      res.status(500).json({ message: "Erreur lors de la création" });
    }
  });

  app.put('/api/admin/ads/:id', adUpload.single('image'), async (req, res) => {
    if (!req.session.userId || req.session.role !== 'ADMIN') {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID invalide" });
    }
    
    try {
      const { title, titleFr, description, descriptionFr, linkUrl, type, position, priority, startDate, endDate, isActive, targetAudience } = req.body;
      
      if (!title || !titleFr) {
        return res.status(400).json({ message: "Les titres sont requis" });
      }
      
      const updateData: any = {
        title,
        titleFr,
        description: description || null,
        descriptionFr: descriptionFr || null,
        linkUrl: linkUrl || null,
        type: type || 'BANNER',
        position: position || 'HOME_TOP',
        priority: parseInt(priority) || 0,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        isActive: isActive === 'true' || isActive === true,
        targetAudience: targetAudience || 'ALL',
        updatedAt: new Date(),
      };
      
      if (req.file) {
        updateData.imageUrl = `/uploads/${req.file.filename}`;
      }
      
      const [updatedAd] = await db.update(advertisements)
        .set(updateData)
        .where(eq(advertisements.id, id))
        .returning();
      
      res.json(updatedAd);
    } catch (error) {
      console.error('❌ Error updating ad:', error);
      res.status(500).json({ message: "Erreur lors de la mise à jour" });
    }
  });

  app.delete('/api/admin/ads/:id', async (req, res) => {
    if (!req.session.userId || req.session.role !== 'ADMIN') {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID invalide" });
    }
    
    try {
      await db.delete(advertisements).where(eq(advertisements.id, id));
      res.json({ message: "Publicité supprimée" });
    } catch (error) {
      console.error('❌ Error deleting ad:', error);
      res.status(500).json({ message: "Erreur lors de la suppression" });
    }
  });

  app.post('/api/ads/:id/click', async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID invalide" });
    }
    
    try {
      if (req.session.userId) {
        await db.insert(adStats).values({
          adId: id,
          userId: req.session.userId,
          action: 'CLICK',
          screen: req.body.screen || 'UNKNOWN',
        }).catch(e => console.error('Failed to record click:', e));
      }
      
      await db.update(advertisements)
        .set({ clickCount: sql`${advertisements.clickCount} + 1` })
        .where(eq(advertisements.id, id));
      
      const [ad] = await db.select().from(advertisements).where(eq(advertisements.id, id));
      res.json({ linkUrl: ad?.linkUrl });
    } catch (error) {
      console.error('❌ Error recording ad click:', error);
      res.status(500).json({ message: "Erreur" });
    }
  });

  app.get('/api/admin/ads/:id/stats', async (req, res) => {
    if (!req.session.userId || req.session.role !== 'ADMIN') {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID invalide" });
    }
    
    try {
      const impressions = await db.select({ count: sql<number>`count(*)` })
        .from(adStats)
        .where(and(
          eq(adStats.adId, id),
          eq(adStats.action, 'IMPRESSION')
        ));
      
      const clicks = await db.select({ count: sql<number>`count(*)` })
        .from(adStats)
        .where(and(
          eq(adStats.adId, id),
          eq(adStats.action, 'CLICK')
        ));
      
      const impressionsCount = Number(impressions[0]?.count || 0);
      const clicksCount = Number(clicks[0]?.count || 0);
      
      res.json({
        impressions: impressionsCount,
        clicks: clicksCount,
        ctr: impressionsCount > 0 ? (clicksCount / impressionsCount  100) : 0,
      });
    } catch (error) {
      console.error('❌ Error getting ad stats:', error);
      res.status(500).json({ message: "Erreur" });
    }
  });

  // ==================== PASSENGER ROUTES ====================

  app.post(api.passenger.createRide.path, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const input = api.passenger.createRide.input.parse(req.body);
      
      if (!isWithinRange(input.pickupLat, input.pickupLng) || 
          !isWithinRange(input.dropLat, input.dropLng)) {
        return res.status(400).json({ 
          message: "Miala tsiny, tsy mbola misy ny Farady amin’ity faritra ity." 
        });
      }

      const distanceKm = input.distanceKm ?? calculateDistance(input.pickupLat, input.pickupLng, input.dropLat, input.dropLng);
      const etaMinutes = input.etaMinutes ?? Math.max(1, Math.round((distanceKm / 25) * 60));

      const ride = await storage.createRide({
        ...input,
        passengerId: req.session.userId,
        status: "REQUESTED",
        pickupLat: input.pickupLat.toString(),
        pickupLng: input.pickupLng.toString(),
        dropLat: input.dropLat.toString(),
        dropLng: input.dropLng.toString(),
        distanceKm: distanceKm.toFixed(2),
        etaMinutes,
      });

      const user = await storage.getUser(req.session.userId);
      await broadcastToDrivers({
        type: WS_EVENTS.RIDE_NEW_REQUEST,
        payload: { ...ride, passenger: user }
      });

      res.status(201).json(ride);
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0].message });
      console.error('❌ Create ride error:', e);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get(api.passenger.getRide.path, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de course invalide" });
    }
    
    const ride = await storage.getRide(id);
    if (!ride) return res.status(404).json({ message: "Not found" });
    
    let driver = undefined;
    if (ride.driverId) {
      driver = await storage.getUser(ride.driverId);
    }
    
    res.json({ ...ride, driver });
  });

  app.get(api.passenger.history.path, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    const rides = await storage.getRideHistory(req.session.userId);
    res.json(rides);
  });

  app.post(api.passenger.cancelRide.path, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de course invalide" });
    }
    
    try {
      const input = api.passenger.cancelRide.input.parse(req.body);
      const ride = await storage.cancelRide(id, input.reason, req.session.role || "PASSENGER");
      
      await broadcastToDrivers({ type: WS_EVENTS.RIDE_STATUS_CHANGED, payload: ride });
      
      res.json(ride);
    } catch (e) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.get(api.passenger.getOffers.path, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de course invalide" });
    }
    
    const rideOffers = await storage.getOffersForRide(id);
    
    const enrichedOffers = await Promise.all(rideOffers.map(async o => {
      const driver = await storage.getUser(o.driverId);
      const profile = await storage.getDriverProfile(o.driverId);
      const locResult = await db.select().from(driverLocations)
        .where(eq(driverLocations.driverId, o.driverId))
        .orderBy(sql`timestamp DESC`)
        .limit(1);
      const location = locResult.length > 0 ? { lat: parseFloat(locResult[0].lat as any), lng: parseFloat(locResult[0].lng as any) } : null;
      return { ...o, driver, profile, location };
    }));
    
    res.json(enrichedOffers);
  });

  app.get('/api/rides/:id/views', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    const onlineDrivers = await storage.getAllDrivers();
    const count = onlineDrivers.filter(d => d.online).length;
    res.json({ viewCount: count });
  });

  app.get('/api/rides/active', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Non authentifié" });
    }
    
    try {
      console.log(`🔍 Fetching active ride for user ${req.session.userId}`);
      
      const allRides = await storage.getRideHistory(req.session.userId);
      console.log(`📋 Found ${allRides.length} rides total`);
      
      const activeRide = allRides.find(r => 
        r.status !== 'COMPLETED' && 
        r.status !== 'CANCELED'
      );
      
      if (!activeRide) {
        console.log(`ℹ️ No active ride for user ${req.session.userId}`);
        return res.status(404).json({ message: "Aucune course active" });
      }
      
      console.log(`✅ Found active ride ${activeRide.id} with status ${activeRide.status}`);
      
      let otherUser = null;
      try {
        if (activeRide.driverId === req.session.userId) {
          otherUser = await storage.getUser(activeRide.passengerId);
          console.log(`👤 Passenger: ${otherUser?.name}`);
        } else if (activeRide.driverId) {
          otherUser = await storage.getUser(activeRide.driverId);
          console.log(`👤 Driver: ${otherUser?.name}`);
        }
      } catch (err) {
        console.error('Error fetching other user:', err);
      }
      
      const response = {
        ...activeRide,
        otherUser: otherUser || null,
        isDriver: activeRide.driverId === req.session.userId,
        passengerName: activeRide.driverId === req.session.userId ? otherUser?.name : undefined,
        passengerPhone: activeRide.driverId === req.session.userId ? otherUser?.phone : undefined,
        driverName: activeRide.driverId !== req.session.userId ? otherUser?.name : undefined,
        driverPhone: activeRide.driverId !== req.session.userId ? otherUser?.phone : undefined,
      };
      
      res.json(response);
    } catch (error) {
      console.error('❌ Error fetching active ride:', error);
      res.status(404).json({ message: "Aucune course active" });
    }
  });

  app.get('/api/driver/:id/location', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    const driverId = parseInt(req.params.id);
    if (isNaN(driverId)) {
      return res.status(400).json({ message: "ID de conducteur invalide" });
    }
    
    const locResult = await db.select().from(driverLocations)
      .where(eq(driverLocations.driverId, driverId))
      .orderBy(sql`timestamp DESC`)
      .limit(1);
    if (locResult.length > 0) {
      res.json({ lat: parseFloat(locResult[0].lat as any), lng: parseFloat(locResult[0].lng as any) });
    } else {
      res.json(null);
    }
  });

  app.get('/api/driver/documents', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Non authentifié" });
    }
    
    try {
      console.log('📄 Fetching driver documents for user:', req.session.userId);
      
      const profile = await storage.getDriverProfile(req.session.userId);
      if (!profile) {
        console.log('ℹ️ No driver profile found for user:', req.session.userId);
        return res.json([]);
      }
      
      const docs = await storage.getDriverDocuments(profile.id);
      console.log(`✅ Found ${docs.length} driver documents`);
      res.json(docs);
    } catch (error) {
      console.error('❌ Error fetching driver documents:', error);
      res.status(500).json({ 
        message: "Erreur serveur",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });
  
  app.post('/api/driver/register', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Non authentifié" });
    }
    
    try {
      const { vehicleType, vehicleNumber, licenseNumber } = req.body;
      
      let existingProfile = await storage.getDriverProfile(req.session.userId);
      
      if (existingProfile) {
        await storage.updateDriverStatus(existingProfile.id, "PENDING");
        await storage.updateDriverOnline(req.session.userId, false);
        
        await db.update(driverProfiles)
          .set({
            vehicleNumber: vehicleNumber || existingProfile.vehicleNumber,
            licenseNumber: licenseNumber || existingProfile.licenseNumber,
            vehicleType: vehicleType || existingProfile.vehicleType,
            status: "PENDING"
          })
          .where(eq(driverProfiles.id, existingProfile.id));
        
        const updatedProfile = await storage.getDriverProfile(req.session.userId);
        return res.json(updatedProfile);
      }
      
      await storage.updateUserRole(req.session.userId, "DRIVER");
      
      const profile = await storage.createDriverProfile({
        userId: req.session.userId,
        vehicleType: vehicleType || "TAXI",
        vehicleNumber: vehicleNumber || "",
        licenseNumber: licenseNumber || "",
        status: "PENDING",
        online: false,
      });
      
      req.session.role = "DRIVER";
      await new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve(null);
        });
      });
      
      res.status(201).json(profile);
    } catch (error) {
      console.error('❌ Error registering driver:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post(api.passenger.acceptOffer.path, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de course invalide" });
    }
    
    try {
      const input = api.passenger.acceptOffer.input.parse(req.body);
      const offer = (await storage.getOffersForRide(id)).find(o => o.id === input.offerId);
      if (!offer) return res.status(404).json({ message: "Offer not found" });

      const ride = await storage.acceptOffer(id, input.offerId, offer.priceAr, offer.driverId);
      
      sendToUser(offer.driverId, { type: WS_EVENTS.OFFER_ACCEPTED, payload: ride });
      
      const passenger = await storage.getUser(req.session.userId);
      await storage.createNotification({
        userId: offer.driverId,
        title: "Tolobidy voaray!",
        message: `${passenger?.name || 'Mpandeha'} dia nanaiky ny tolobidy Ar ${offer.priceAr}`,
        type: "OFFER_ACCEPTED",
        rideId: id,
      });
      
      res.json(ride);
    } catch (e) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.post(api.passenger.rateRide.path, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de course invalide" });
    }
    
    try {
      const input = api.passenger.rateRide.input.parse(req.body);
      const ride = await storage.getRide(id);
      if (!ride) return res.status(404).json({ message: "Ride not found" });
      if (ride.passengerId !== req.session.userId) return res.status(403).json({ message: "Forbidden" });
      if (ride.status !== "COMPLETED") return res.status(400).json({ message: "Ride not completed" });
      if (!ride.driverId) return res.status(400).json({ message: "No driver assigned" });

      await storage.rateDriver(ride.driverId, input.rating);

      await storage.createNotification({
        userId: ride.driverId,
        title: "Nahazo note vaovao",
        message: `Nahazo note ${input.rating}/5 ianao`,
        type: "RATING",
        rideId: id,
      });

      res.json({ message: "Rating submitted" });
    } catch (e) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  // ==================== DRIVER ROUTES ====================

  app.post(api.driver.setOnline.path, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const input = api.driver.setOnline.input.parse(req.body);
      const profile = await storage.updateDriverOnline(req.session.userId, input.online);
      res.json(profile);
    } catch (e) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.get(api.driver.getProfile.path, async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const profile = await storage.getDriverProfile(req.session.userId);
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }
      
      const docs = await storage.getDriverDocuments(profile.id);
      res.json({ ...profile, documents: docs });
    } catch (error) {
      console.error('❌ Error fetching driver profile:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.get(api.driver.getRequests.path, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    
    const rides = await storage.getNearbyRequests();
    
    const enrichedRides = await Promise.all(rides.map(async r => {
      const passenger = await storage.getUser(r.passengerId);
      return { ...r, passenger };
    }));
    
    res.json(enrichedRides);
  });

  app.post(api.driver.sendOffer.path, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const input = api.driver.sendOffer.input.parse(req.body);
      
      const offer = await storage.createOffer({
        ...input,
        driverId: req.session.userId,
        expiresAt: new Date(Date.now() + 90000),
      });

      const ride = await storage.getRide(input.rideId);
      if (ride) {
        sendToUser(ride.passengerId, { type: WS_EVENTS.OFFER_NEW, payload: offer });
        const driver = await storage.getUser(req.session.userId);
        await storage.createNotification({
          userId: ride.passengerId,
          title: "Tolobidy vaovao",
          message: `${driver?.name || 'Mpamily'} dia nanolotra Ar ${input.priceAr}`,
          type: "OFFER",
          rideId: input.rideId,
        });
      }

      res.status(201).json(offer);
    } catch (e) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.post(api.driver.updateRideStatus.path, async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de course invalide" });
    }
    
    try {
      const input = api.driver.updateRideStatus.input.parse(req.body);
      
      const ride = await storage.getRide(id);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      
      if (ride.driverId !== req.session.userId) {
        return res.status(403).json({ message: "Forbidden - not your ride" });
      }
      
      const validTransitions: Record<string, string[]> = {
        'ASSIGNED': ['DRIVER_EN_ROUTE'],
        'DRIVER_EN_ROUTE': ['DRIVER_ARRIVED'],
        'DRIVER_ARRIVED': ['IN_PROGRESS'],
        'IN_PROGRESS': ['COMPLETED'],
      };
      
      if (!validTransitions[ride.status]?.includes(input.status)) {
        return res.status(400).json({ 
          message: `Invalid status transition from ${ride.status} to ${input.status}` 
        });
      }
      
      const updatedRide = await storage.updateRideStatus(id, input.status);
      
      sendToUser(ride.passengerId, { 
        type: WS_EVENTS.RIDE_STATUS_CHANGED, 
        payload: updatedRide 
      });
      
      res.json(updatedRide);
    } catch (e) {
      console.error("Error updating ride status:", e);
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.post(api.driver.updateLocation.path, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const { lat, lng } = req.body;
      if (lat && lng) {
        await db.insert(driverLocations).values({
          driverId: req.session.userId,
          lat: lat.toString(),
          lng: lng.toString(),
        });

        const activeRides = await db.select().from(rides)
          .where(and(
            eq(rides.driverId, req.session.userId),
            or(
              eq(rides.status, 'ASSIGNED'),
              eq(rides.status, 'DRIVER_EN_ROUTE'),
              eq(rides.status, 'DRIVER_ARRIVED'),
              eq(rides.status, 'IN_PROGRESS')
            )
          ));
        for (const ride of activeRides) {
          sendToUser(ride.passengerId, {
            type: WS_EVENTS.DRIVER_LOCATION,
            payload: { driverId: req.session.userId, lat, lng, rideId: ride.id }
          });
        }
      }
      res.json({ success: true });
    } catch {
      res.json({ success: true });
    }
  });

  app.get('/api/driver/active-ride', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const activeRide = await storage.getDriverActiveRide(req.session.userId);
      
      if (!activeRide) {
        return res.status(404).json({ message: "No active ride" });
      }
      
      const passenger = await storage.getUser(activeRide.passengerId);
      
      res.json({
        ...activeRide,
        passengerName: passenger?.name,
        passengerPhone: passenger?.phone,
      });
    } catch (error) {
      console.error('Error fetching driver active ride:', error);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.patch('/api/rides/:id/status', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de course invalide" });
    }
    
    const { status } = req.body;
    
    try {
      const ride = await storage.getRide(id);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      
      if (ride.driverId !== req.session.userId && ride.passengerId !== req.session.userId) {
        return res.status(403).json({ message: "Forbidden - not your ride" });
      }
      
      const validTransitions: Record<string, Record<string, string[]>> = {
        'PASSENGER': {
          'REQUESTED': ['CANCELED'],
          'BIDDING': ['CANCELED'],
          'ASSIGNED': ['CANCELED'],
        },
        'DRIVER': {
          'ASSIGNED': ['DRIVER_EN_ROUTE', 'CANCELED'],
          'DRIVER_EN_ROUTE': ['DRIVER_ARRIVED', 'CANCELED'],
          'DRIVER_ARRIVED': ['IN_PROGRESS', 'CANCELED'],
          'IN_PROGRESS': ['COMPLETED', 'CANCELED'],
        }
      };
      
      const userRole = req.session.role || (ride.driverId === req.session.userId ? 'DRIVER' : 'PASSENGER');
      const allowedTransitions = validTransitions[userRole]?.[ride.status] || [];
      
      if (status && !allowedTransitions.includes(status)) {
        return res.status(400).json({ 
          message: `Invalid status transition from ${ride.status} to ${status} for ${userRole}` 
        });
      }
      
      const updatedRide = await storage.updateRideStatus(id, status);
      
      const otherUserId = ride.passengerId === req.session.userId ? ride.driverId : ride.passengerId;
      if (otherUserId) {
        sendToUser(otherUserId, {
          type: WS_EVENTS.RIDE_STATUS_CHANGED,
          payload: updatedRide
        });
      }
      
      res.json(updatedRide);
    } catch (error) {
      console.error('❌ Error updating ride status:', error);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post(api.driver.uploadDocument.path, upload.single('file'), async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const docType = req.body.type || 'PHOTO';
    
    try {
      let profile = await storage.getDriverProfile(req.session.userId);
      if (!profile) {
        await storage.updateUserRole(req.session.userId, "DRIVER");
        profile = await storage.createDriverProfile({
          userId: req.session.userId,
          vehicleType: req.body.vehicleType || "TAXI",
          status: "PENDING",
          vehicleNumber: req.body.vehicleNumber || "",
          licenseNumber: req.body.licenseNumber || ""
        });
      }
      
      const fileUrl = req.file ? `/uploads/${req.file.filename}` : '';
      const doc = await storage.createDriverDocument({
        driverId: profile.id,
        type: docType,
        url: fileUrl,
      });
      
      res.status(201).json(doc);
    } catch (error) {
      console.error('❌ Error uploading driver document:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post('/api/rides/:id/eta', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de course invalide" });
    }
    
    const { additionalMinutes } = req.body;
    
    if (!additionalMinutes || additionalMinutes < 1 || additionalMinutes > 30) {
      return res.status(400).json({ message: "Minutes supplémentaires invalides (1-30)" });
    }
    
    try {
      const ride = await storage.getRide(id);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      
      if (ride.driverId !== req.session.userId) {
        return res.status(403).json({ message: "Forbidden - not your ride" });
      }
      
      const currentEta = ride.etaMinutes || 0;
      const newEta = currentEta + additionalMinutes;
      
      const [updated] = await db.update(rides)
        .set({ etaMinutes: newEta, updatedAt: new Date() })
        .where(eq(rides.id, id))
        .returning();
      
      sendToUser(ride.passengerId, {
        type: WS_EVENTS.RIDE_STATUS_CHANGED,
        payload: updated
      });
      
      res.json(updated);
    } catch (error) {
      console.error('❌ Error updating ETA:', error);
      res.status(500).json({ message: "Internal error" });
    }
  });

  // ==================== ADMIN ROUTES ====================

  app.get('/api/admin/stats', async (req, res) => {
    console.log('📊 Admin stats called');
    
    if (!req.session.userId) {
      console.log('❌ No userId in session');
      return res.status(401).json({ message: "Non authentifié" });
    }
    
    if (req.session.role !== 'ADMIN') {
      console.log(`❌ Forbidden - role is ${req.session.role}, expected ADMIN`);
      return res.status(403).json({ message: "Accès refusé - rôle incorrect" });
    }
    
    try {
      const stats = await storage.getAdminStats();
      console.log('✅ Stats retrieved successfully');
      res.json(stats);
    } catch (error) {
      console.error('❌ Error getting stats:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.get(api.admin.getDrivers.path, async (req, res) => {
    console.log('👥 Admin getDrivers called');
    console.log('📋 Session:', {
      userId: req.session?.userId,
      role: req.session?.role,
      sessionId: req.sessionID
    });
    
    if (!req.session.userId) {
      console.log('❌ No userId in session');
      return res.status(401).json({ message: "Non authentifié" });
    }
    
    if (req.session.role !== 'ADMIN') {
      console.log(`❌ Forbidden - role is ${req.session.role}, expected ADMIN`);
      return res.status(403).json({ message: "Accès refusé - rôle incorrect" });
    }
    
    try {
      console.log('🔄 Fetching drivers from storage...');
      const drivers = await storage.getDriversWithDetails();
      console.log(`✅ Successfully retrieved ${drivers.length} drivers`);
      
      if (drivers.length > 0) {
        console.log('📊 Sample driver:', {
          id: drivers[0].id,
          name: drivers[0].name,
          role: drivers[0].role,
          profileStatus: drivers[0].profile?.status,
          hasProfile: !!drivers[0].profile
        });
      } else {
        console.log('⚠️ No drivers found in database');
        
        const allProfiles = await db.select().from(driverProfiles);
        console.log(`📋 Total driver profiles in DB: ${allProfiles.length}`);
        
        if (allProfiles.length > 0) {
          console.log('📋 Profiles found but users might be missing:');
          for (const p of allProfiles) {
            const user = await storage.getUser(p.userId);
            console.log(`  - Profile ${p.id}: userId=${p.userId}, status=${p.status}, userExists=${!!user}`);
          }
        }
      }
      
      res.json(drivers);
    } catch (error) {
      console.error('❌ Error getting drivers:', error);
      res.status(500).json({ 
        message: "Erreur serveur", 
        error: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  app.post(api.admin.updateDriverStatus.path, async (req, res) => {
    if (!req.session.userId || req.session.role !== 'ADMIN') return res.status(403).json({ message: "Forbidden" });
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de profil invalide" });
    }
    
    try {
      const input = api.admin.updateDriverStatus.input.parse(req.body);
      const status = input.action === "APPROVE" ? "APPROVED" : input.action === "REJECT" ? "REJECTED" : "SUSPENDED";
      const profile = await storage.updateDriverStatus(id, status);
      
      if (input.action === "REJECT") {
        const driverProfile = await storage.getDriverProfileById(id);
        if (driverProfile) {
          await storage.updateUserRole(driverProfile.userId, "PASSENGER");
          console.log(`✅ User ${driverProfile.userId} reverted to PASSENGER after rejection`);
        }
      }
      
      if (input.action === "SUSPEND") {
        await storage.updateDriverOnlineByProfileId(id, false);
      }
      
      res.json(profile);
    } catch (e) {
      console.error('❌ Error updating driver status:', e);
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.get(api.admin.getUsers.path, async (req, res) => {
    console.log('👥 Admin getUsers called');
    
    if (!req.session.userId || req.session.role !== 'ADMIN') {
      console.log('❌ Forbidden - not admin');
      return res.status(403).json({ message: "Forbidden" });
    }
    
    try {
      const allUsers = await storage.getAllUsers();
      console.log(`✅ ${allUsers.length} users retrieved`);
      res.json(allUsers);
    } catch (error) {
      console.error('❌ Error getting users:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.get(api.admin.getRides.path, async (req, res) => {
    console.log('🚗 Admin getRides called');
    
    if (!req.session.userId || req.session.role !== 'ADMIN') {
      console.log('❌ Forbidden - not admin');
      return res.status(403).json({ message: "Forbidden" });
    }
    
    try {
      const ridesData = await storage.getRidesWithDetails();
      console.log(`✅ ${ridesData.length} rides retrieved`);
      res.json(ridesData);
    } catch (error) {
      console.error('❌ Error getting rides:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post('/api/admin/users/:id/block', async (req, res) => {
    if (!req.session.userId || req.session.role !== 'ADMIN') return res.status(403).json({ message: "Forbidden" });
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID utilisateur invalide" });
    }
    
    const { blocked } = req.body;
    const user = await storage.blockUser(id, blocked);
    res.json(user);
  });

  app.post('/api/admin/rides/:id/cancel', async (req, res) => {
    if (!req.session.userId || req.session.role !== 'ADMIN') return res.status(403).json({ message: "Forbidden" });
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de course invalide" });
    }
    
    const { reason } = req.body;
    const ride = await storage.adminCancelRide(id, reason || "Cancelled by admin");
    res.json(ride);
  });

  app.get('/api/admin/driver-locations', async (req, res) => {
    if (!req.session.userId || req.session.role !== 'ADMIN') return res.status(403).json({ message: "Forbidden" });
    const locs = await db.execute(sql`
      SELECT DISTINCT ON (dl.driver_id)
        dl.driver_id as "driverId", dl.lat, dl.lng, dl.timestamp,
        u.name, u.phone,
        dp.vehicle_type as "vehicleType", dp.online, dp.status
      FROM driver_locations dl
      INNER JOIN users u ON dl.driver_id = u.id
      INNER JOIN driver_profiles dp ON dp.user_id = u.id
      ORDER BY dl.driver_id, dl.timestamp DESC
    `);
    res.json(locs.rows);
  });

  app.get(api.admin.getConfig.path, async (req, res) => {
    console.log('⚙️ Admin getConfig called');
    
    if (!req.session.userId || req.session.role !== 'ADMIN') {
      console.log('❌ Forbidden - not admin');
      return res.status(403).json({ message: "Forbidden" });
    }
    
    try {
      const config = await storage.getConfig();
      console.log('✅ Config retrieved');
      res.json(config);
    } catch (error) {
      console.error('❌ Error getting config:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post(api.admin.updateConfig.path, async (req, res) => {
    if (!req.session.userId || req.session.role !== 'ADMIN') return res.status(403).json({ message: "Forbidden" });
    try {
      const input = api.admin.updateConfig.input.parse(req.body);
      const config = await storage.updateConfig(input);
      res.json(config);
    } catch (e) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  // ==================== NOTIFICATION ROUTES ====================

  app.get('/api/notifications', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    const notifs = await storage.getNotifications(req.session.userId);
    res.json(notifs);
  });

  app.get('/api/notifications/unread-count', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    const count = await storage.getUnreadCount(req.session.userId);
    res.json({ count });
  });

  app.post('/api/notifications/:id/read', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de notification invalide" });
    }
    await storage.markAsRead(id, req.session.userId);
    res.json({ message: "ok" });
  });

  app.post('/api/notifications/read-all', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    await storage.markAllAsRead(req.session.userId);
    res.json({ message: "ok" });
  });

  // ==================== USER ROUTES ====================

  app.post('/api/user/update', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    const { name } = req.body;
    const user = await storage.updateUser(req.session.userId, { name });
    res.json(user);
  });

  // ==================== PASSENGER DOCUMENTS ROUTES ====================

  app.get('/api/passenger/documents', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Non authentifié" });
    }
    
    try {
      console.log('📄 Fetching passenger documents for user:', req.session.userId);
      
      const docs = await db.select().from(passengerDocuments)
        .where(eq(passengerDocuments.userId, req.session.userId));
      
      console.log(`✅ Found ${docs.length} passenger documents`);
      res.json(docs);
    } catch (error) {
      console.error('❌ Error fetching passenger documents:', error);
      res.status(500).json({ 
        message: "Erreur serveur",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  app.post('/api/passenger/documents', upload.single('file'), async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Non authentifié" });
    }
    
    try {
      const docType = req.body.type || 'CIN';
      const fileUrl = req.file ? `/uploads/${req.file.filename}` : '';
      
      console.log('📤 Uploading passenger document:', { docType, fileUrl, userId: req.session.userId });
      
      if (!req.file) {
        return res.status(400).json({ message: "Aucun fichier fourni" });
      }
      
      const [doc] = await db.insert(passengerDocuments).values({
        userId: req.session.userId,
        type: docType,
        url: fileUrl,
        uploadedAt: new Date(),
      }).returning();
      
      await storage.updateUser(req.session.userId, { 
        idCardUrl: fileUrl,
        isApproved: true
      });
      
      console.log('✅ Passenger document uploaded successfully:', doc.id);
      res.status(201).json(doc);
    } catch (error) {
      console.error('❌ Error uploading passenger document:', error);
      res.status(500).json({ 
        message: "Erreur lors de l'upload",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  app.delete('/api/passenger/documents/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Non authentifié" });
    }
    
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de document invalide" });
    }
    
    try {
      console.log('🗑️ Deleting passenger document:', id);
      
      await db.delete(passengerDocuments)
        .where(and(
          eq(passengerDocuments.id, id),
          eq(passengerDocuments.userId, req.session.userId)
        ));
      
      console.log('✅ Passenger document deleted');
      res.json({ message: "Document supprimé" });
    } catch (error) {
      console.error('❌ Error deleting passenger document:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // ==================== BOOKINGS ROUTES ====================

  app.post('/api/bookings', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      console.log('📅 Creating booking with data:', req.body);
      
      const { 
        pickupLat, pickupLng, pickupAddress,
        dropLat, dropLng, dropAddress,
        vehicleType, scheduledFor, note,
        distanceKm, etaMinutes, estimatedPriceAr
      } = req.body;
      
      if (!pickupLat || !pickupLng || !pickupAddress || 
          !dropLat || !dropLng || !dropAddress || 
          !vehicleType || !scheduledFor) {
        console.log('❌ Missing required fields');
        return res.status(400).json({ message: "Champs requis manquants" });
      }
      
      if (!isWithinRange(pickupLat, pickupLng) || !isWithinRange(dropLat, dropLng)) {
        return res.status(400).json({ 
          message: "Miala tsiny, tsy mbola misy ny Farady amin’ity faritra ity." 
        });
      }
      
      const scheduledDate = new Date(scheduledFor);
      if (isNaN(scheduledDate.getTime())) {
        return res.status(400).json({ message: "Date invalide" });
      }
      
      if (scheduledDate <= new Date()) {
        return res.status(400).json({ message: "La réservation doit être dans le futur" });
      }
      
      const [booking] = await db.insert(bookings).values({
        passengerId: req.session.userId,
        status: "PENDING",
        pickupLat: pickupLat.toString(),
        pickupLng: pickupLng.toString(),
        pickupAddress,
        dropLat: dropLat.toString(),
        dropLng: dropLng.toString(),
        dropAddress,
        vehicleType,
        scheduledFor: scheduledDate,
        note: note || null,
        distanceKm: distanceKm ? distanceKm.toString() : null,
        etaMinutes: etaMinutes || null,
        estimatedPriceAr: estimatedPriceAr || null,
      }).returning();
      
      console.log('✅ Booking created:', booking.id);
      
      try {
        const passenger = await storage.getUser(req.session.userId);
        await broadcastToDrivers({
          type: WS_EVENTS.BOOKING_NEW,
          payload: { ...booking, passenger }
        });
      } catch (err) {
        console.error('Error broadcasting to drivers:', err);
      }
      
      res.status(201).json(booking);
    } catch (error) {
      console.error('❌ Error creating booking:', error);
      res.status(500).json({ 
        message: "Erreur interne",
        error: process.env.NODE_ENV === 'development' ? String(error) : undefined
      });
    }
  });

  app.get('/api/bookings', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const userBookings = await db.select().from(bookings)
        .where(eq(bookings.passengerId, req.session.userId))
        .orderBy(sql`${bookings.scheduledFor} DESC`);
      
      res.json(userBookings);
    } catch (error) {
      console.error('❌ Error fetching bookings:', error);
      res.status(500).json({ message: "Erreur interne" });
    }
  });

  app.get('/api/bookings/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de réservation invalide" });
    }
    
    try {
      const booking = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
      
      if (!booking.length) {
        return res.status(404).json({ message: "Réservation non trouvée" });
      }
      
      const bookingData = booking[0];
      
      if (bookingData.passengerId !== req.session.userId && 
          (!bookingData.driverId || bookingData.driverId !== req.session.userId) &&
          req.session.role !== 'ADMIN') {
        return res.status(403).json({ message: "Accès non autorisé" });
      }
      
      let driver = null;
      if (bookingData.driverId) {
        driver = await storage.getUser(bookingData.driverId);
      }
      
      const offers = await db.select().from(bookingOffers)
        .where(eq(bookingOffers.bookingId, id));
      
      res.json({ ...bookingData, driver, offers });
    } catch (error) {
      console.error('❌ Error fetching booking:', error);
      res.status(500).json({ message: "Erreur interne" });
    }
  });

  app.post('/api/bookings/:id/offers', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    if (req.session.role !== 'DRIVER') {
      return res.status(403).json({ message: "Seuls les conducteurs peuvent faire des offres" });
    }
    
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de réservation invalide" });
    }
    
    const { priceAr, etaMinutes, message } = req.body;
    
    if (!priceAr || !etaMinutes) {
      return res.status(400).json({ message: "Prix et ETA requis" });
    }
    
    try {
      const booking = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
      
      if (!booking.length) {
        return res.status(404).json({ message: "Réservation non trouvée" });
      }
      
      const bookingData = booking[0];
      
      if (bookingData.status !== 'PENDING') {
        return res.status(400).json({ message: "Cette réservation n'est plus disponible" });
      }
      
      if (bookingData.driverId === req.session.userId) {
        return res.status(400).json({ message: "Vous avez déjà accepté cette réservation" });
      }
      
      const existingOffer = await db.select().from(bookingOffers)
        .where(and(
          eq(bookingOffers.bookingId, id),
          eq(bookingOffers.driverId, req.session.userId),
          eq(bookingOffers.status, 'SENT')
        ));
      
      if (existingOffer.length) {
        return res.status(400).json({ message: "Vous avez déjà envoyé une offre" });
      }
      
      const [offer] = await db.insert(bookingOffers).values({
        bookingId: id,
        driverId: req.session.userId,
        priceAr,
        etaMinutes,
        message: message || null,
        expiresAt: new Date(Date.now() + 90000),
      }).returning();
      
      const driver = await storage.getUser(req.session.userId);
      sendToUser(bookingData.passengerId, {
        type: WS_EVENTS.BOOKING_OFFER_NEW,
        payload: { ...offer, driver, booking: bookingData }
      });
      
      res.status(201).json(offer);
    } catch (error) {
      console.error('❌ Error creating booking offer:', error);
      res.status(500).json({ message: "Erreur interne" });
    }
  });

  app.post('/api/bookings/:id/accept-offer', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de réservation invalide" });
    }
    
    const { offerId } = req.body;
    
    try {
      const booking = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
      
      if (!booking.length) {
        return res.status(404).json({ message: "Réservation non trouvée" });
      }
      
      const bookingData = booking[0];
      
      if (bookingData.passengerId !== req.session.userId) {
        return res.status(403).json({ message: "Non autorisé" });
      }
      
      if (bookingData.status !== 'PENDING') {
        return res.status(400).json({ message: "Cette réservation n'est plus disponible" });
      }
      
      const offer = await db.select().from(bookingOffers).where(eq(bookingOffers.id, offerId)).limit(1);
      
      if (!offer.length || offer[0].bookingId !== id) {
        return res.status(404).json({ message: "Offre non trouvée" });
      }
      
      const offerData = offer[0];
      
      if (offerData.status !== 'SENT') {
        return res.status(400).json({ message: "Cette offre n'est plus valide" });
      }
      
      if (new Date() > offerData.expiresAt) {
        await db.update(bookingOffers).set({ status: 'EXPIRED' }).where(eq(bookingOffers.id, offerId));
        return res.status(400).json({ message: "L'offre a expiré" });
      }
      
      await db.update(bookingOffers).set({ status: 'ACCEPTED' }).where(eq(bookingOffers.id, offerId));
      
      await db.update(bookingOffers)
        .set({ status: 'EXPIRED' })
        .where(and(
          eq(bookingOffers.bookingId, id),
          sql`${bookingOffers.id} != ${offerId}`
        ));
      
      const [updatedBooking] = await db.update(bookings)
        .set({ 
          status: 'CONFIRMED', 
          driverId: offerData.driverId,
          finalPriceAr: offerData.priceAr,
          updatedAt: new Date()
        })
        .where(eq(bookings.id, id))
        .returning();
      
      const passenger = await storage.getUser(req.session.userId);
      sendToUser(offerData.driverId, {
        type: WS_EVENTS.BOOKING_OFFER_ACCEPTED,
        payload: { ...updatedBooking, passenger }
      });
      
      res.json(updatedBooking);
    } catch (error) {
      console.error('❌ Error accepting booking offer:', error);
      res.status(500).json({ message: "Erreur interne" });
    }
  });

  app.post('/api/bookings/:id/cancel', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de réservation invalide" });
    }
    
    const { reason } = req.body;
    
    try {
      const booking = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
      
      if (!booking.length) {
        return res.status(404).json({ message: "Réservation non trouvée" });
      }
      
      const bookingData = booking[0];
      
      if (bookingData.passengerId !== req.session.userId && 
          (!bookingData.driverId || bookingData.driverId !== req.session.userId) &&
          req.session.role !== 'ADMIN') {
        return res.status(403).json({ message: "Non autorisé" });
      }
      
      if (bookingData.status === 'COMPLETED' || bookingData.status === 'CANCELED') {
        return res.status(400).json({ message: "Impossible d'annuler cette réservation" });
      }
      
      const cancelBy = req.session.role === 'ADMIN' ? 'ADMIN' : 
                       (bookingData.driverId === req.session.userId ? 'DRIVER' : 'PASSENGER');
      
      const [cancelledBooking] = await db.update(bookings)
        .set({ 
          status: 'CANCELED',
          cancelBy,
          cancelReason: reason || null,
          updatedAt: new Date()
        })
        .where(eq(bookings.id, id))
        .returning();
      
      const otherUserId = bookingData.passengerId === req.session.userId ? bookingData.driverId : bookingData.passengerId;
      if (otherUserId) {
        sendToUser(otherUserId, {
          type: WS_EVENTS.BOOKING_STATUS_CHANGED,
          payload: cancelledBooking
        });
      }
      
      res.json(cancelledBooking);
    } catch (error) {
      console.error('❌ Error canceling booking:', error);
      res.status(500).json({ message: "Erreur interne" });
    }
  });

  app.get('/api/driver/bookings', async (req, res) => {
    if (!req.session.userId || req.session.role !== 'DRIVER') {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const availableBookings = await db.select().from(bookings)
        .where(and(
          eq(bookings.status, 'PENDING'),
          sql`${bookings.scheduledFor} > NOW()`
        ))
        .orderBy(sql`${bookings.scheduledFor} ASC`);
      
      const enrichedBookings = await Promise.all(availableBookings.map(async b => {
        const passenger = await storage.getUser(b.passengerId);
        return { ...b, passenger };
      }));
      
      res.json(enrichedBookings);
    } catch (error) {
      console.error('❌ Error fetching driver bookings:', error);
      res.status(500).json({ message: "Erreur interne" });
    }
  });

  app.get('/api/driver/bookings/my', async (req, res) => {
    if (!req.session.userId || req.session.role !== 'DRIVER') {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const myBookings = await db.select().from(bookings)
        .where(and(
          eq(bookings.driverId, req.session.userId),
          sql`${bookings.status} != 'CANCELED'`
        ))
        .orderBy(sql`${bookings.scheduledFor} ASC`);
      
      const enrichedBookings = await Promise.all(myBookings.map(async b => {
        const passenger = await storage.getUser(b.passengerId);
        return { ...b, passenger };
      }));
      
      res.json(enrichedBookings);
    } catch (error) {
      console.error('❌ Error fetching my driver bookings:', error);
      res.status(500).json({ message: "Erreur interne" });
    }
  });

  app.get('/api/driver/bookings/upcoming', async (req, res) => {
    if (!req.session.userId || req.session.role !== 'DRIVER') {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const bookings = await db.select().from(bookings)
        .where(and(
          eq(bookings.driverId, req.session.userId),
          or(
            eq(bookings.status, 'CONFIRMED'),
            eq(bookings.status, 'ASSIGNED')
          ),
          sql`${bookings.scheduledFor} > NOW() - INTERVAL '1 hour'`
        ))
        .orderBy(sql`${bookings.scheduledFor} ASC`);
      
      const enriched = await Promise.all(bookings.map(async b => {
        const passenger = await storage.getUser(b.passengerId);
        return { ...b, passenger };
      }));
      
      res.json(enriched);
    } catch (error) {
      console.error('❌ Error fetching upcoming bookings:', error);
      res.status(500).json({ message: "Erreur interne" });
    }
  });

  app.post('/api/bookings/:id/start-ride', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    if (req.session.role !== 'DRIVER') {
      return res.status(403).json({ message: "Seuls les conducteurs peuvent démarrer une réservation" });
    }
    
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de réservation invalide" });
    }
    
    try {
      const booking = await storage.getBooking(id);
      if (!booking) {
        return res.status(404).json({ message: "Réservation non trouvée" });
      }
      
      if (booking.driverId !== req.session.userId) {
        return res.status(403).json({ message: "Vous n'êtes pas le conducteur assigné" });
      }
      
      if (booking.status !== 'CONFIRMED') {
        return res.status(400).json({ message: "La réservation n'est pas confirmée" });
      }
      
      const scheduledFor = new Date(booking.scheduledFor);
      const now = new Date();
      const hoursDiff = (scheduledFor.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff > 2) {
        return res.status(400).json({ 
          message: `Vous ne pouvez démarrer que 2h avant l'heure prévue (${hoursDiff.toFixed(1)}h restantes)` 
        });
      }
      
      const ride = await storage.createRideFromBooking(booking.id, req.session.userId);
      
      await storage.updateBookingStatus(id, 'IN_PROGRESS', booking.driverId);
      
      sendToUser(booking.passengerId, {
        type: WS_EVENTS.RIDE_STATUS_CHANGED,
        payload: ride
      });
      
      res.status(201).json(ride);
    } catch (error) {
      console.error('❌ Error starting ride from booking:', error);
      res.status(500).json({ message: "Erreur interne" });
    }
  });

  app.get('/api/admin/bookings', async (req, res) => {
    if (!req.session.userId || req.session.role !== 'ADMIN') {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    try {
      const allBookings = await storage.getAllBookings();
      
      const enrichedBookings = await Promise.all(allBookings.map(async b => {
        const passenger = await storage.getUser(b.passengerId);
        const driver = b.driverId ? await storage.getUser(b.driverId) : null;
        return { ...b, passenger, driver };
      }));
      
      res.json(enrichedBookings);
    } catch (error) {
      console.error('❌ Error fetching bookings:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post('/api/admin/bookings/:id/cancel', async (req, res) => {
    if (!req.session.userId || req.session.role !== 'ADMIN') {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de réservation invalide" });
    }
    
    const { reason } = req.body;
    
    try {
      const cancelledBooking = await storage.cancelBooking(id, reason || "Annulé par l'admin", "ADMIN");
      
      if (cancelledBooking.passengerId) {
        sendToUser(cancelledBooking.passengerId, {
          type: WS_EVENTS.BOOKING_STATUS_CHANGED,
          payload: cancelledBooking
        });
      }
      if (cancelledBooking.driverId) {
        sendToUser(cancelledBooking.driverId, {
          type: WS_EVENTS.BOOKING_STATUS_CHANGED,
          payload: cancelledBooking
        });
      }
      
      res.json(cancelledBooking);
    } catch (error) {
      console.error('❌ Error canceling booking:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // ==================== PLACES ROUTES ====================

  app.get('/api/places', async (_req, res) => {
    const places = await storage.getCustomPlaces();
    res.json(places);
  });

  app.get('/api/admin/places', async (req, res) => {
    if (!req.session.role || req.session.role !== 'ADMIN') return res.status(403).json({ message: "Forbidden" });
    const places = await storage.getCustomPlaces();
    res.json(places);
  });

  app.post('/api/admin/places', async (req, res) => {
    if (!req.session.role || req.session.role !== 'ADMIN') return res.status(403).json({ message: "Forbidden" });
    const { name, nameFr, lat, lng } = req.body;
    if (!name || !nameFr || !lat || !lng) return res.status(400).json({ message: "Missing fields" });
    const place = await storage.createCustomPlace({ name, nameFr, lat: String(lat), lng: String(lng) });
    res.status(201).json(place);
  });

  app.put('/api/admin/places/:id', async (req, res) => {
    if (!req.session.role || req.session.role !== 'ADMIN') return res.status(403).json({ message: "Forbidden" });
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de lieu invalide" });
    }
    const { name, nameFr, lat, lng } = req.body;
    if (!name || !nameFr || !lat || !lng) return res.status(400).json({ message: "Missing fields" });
    const place = await storage.updateCustomPlace(id, { name, nameFr, lat: String(lat), lng: String(lng) });
    res.json(place);
  });

  app.delete('/api/admin/places/:id', async (req, res) => {
    if (!req.session.role || req.session.role !== 'ADMIN') return res.status(403).json({ message: "Forbidden" });
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de lieu invalide" });
    }
    await storage.deleteCustomPlace(id);
    res.json({ message: "Deleted" });
  });

  // ==================== SEED DATABASE ====================

  async function seedDatabase() {
    try {
      const admin = await storage.getUserByPhone("0340000000");
      if (!admin) {
        await storage.createUser({ phone: "0340000000", name: "Admin Farady", role: "ADMIN" });
        console.log('✅ Admin user created');
      }
      
      const passenger = await storage.getUserByPhone("0341111111");
      if (!passenger) {
        await storage.createUser({ phone: "0341111111", name: "Rabe Passenger", role: "PASSENGER" });
        console.log('✅ Passenger user created');
      }
      
      const driver = await storage.getUserByPhone("0342222222");
      if (!driver) {
        const d = await storage.createUser({ phone: "0342222222", name: "Rakoto Driver", role: "DRIVER" });
        await storage.createDriverProfile({ userId: d.id, vehicleType: "TAXI", status: "APPROVED", online: true });
        console.log('✅ Driver user created');
      }
    } catch (error) {
      console.error('❌ Error seeding database:', error);
    }
  }

  seedDatabase().catch(console.error);

  return httpServer;
}