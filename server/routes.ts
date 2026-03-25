import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { api } from "@shared/routes";
import { 
  users, driverProfiles, rides, offers, appConfig, driverLocations, driverDocuments, customPlaces, 
  advertisements, adStats, isWithinRange, calculateDistance, WS_EVENTS 
} from "@shared/schema";
import { z } from "zod";
import { eq, and, or, sql } from "drizzle-orm";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import express from "express";

// Configuration multer pour l'upload des fichiers
const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, 'uploads/'),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s/g, '_')}`),
});

const upload = multer({ 
  storage: uploadStorage, 
  limits: { fileSize: 10 * 1024 * 1024 } 
});

// Configuration spécifique pour les publicités (5MB max, seulement images)
const adUpload = multer({
  storage: uploadStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images sont acceptées (JPEG, PNG, GIF, WEBP)'));
    }
  }
});

// Extend session to store userId
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

  // Middleware pour vérifier que la session est initialisée
  app.use((req, res, next) => {
    if (!req.session) {
      console.error('❌ Session not initialized for request:', req.path);
      return res.status(500).json({ message: "Session not initialized" });
    }
    next();
  });

  // Middleware pour vérifier l'authentification
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Non authentifié" });
    }
    next();
  };

  // Middleware pour vérifier le rôle admin
  const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.userId || req.session?.role !== 'ADMIN') {
      return res.status(403).json({ message: "Accès refusé" });
    }
    next();
  };

  app.use('/uploads', express.static('uploads'));
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    if (url.pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  // Manage WS clients
  const clients = new Map<number, WebSocket>();

  wss.on('connection', (ws, req) => {
    let userId: number | null = null;
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'auth' && data.payload?.userId) {
          userId = data.payload.userId;
          clients.set(userId!, ws);
          console.log(`✅ WebSocket authenticated for user ${userId}`);
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

  // ==================== AUTH ROUTES ====================

  app.post(api.auth.requestOtp.path, async (req, res) => {
    try {
      console.log('📞 Backend - requestOtp called');
      console.log('📦 Body:', req.body);
      
      const input = api.auth.requestOtp.input.parse(req.body);
      console.log(`✅ OTP for ${input.phone} is 123456`);
      
      res.json({ message: "OTP sent", success: true });
    } catch (e) {
      console.error('❌ OTP request error:', e);
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: "Numéro de téléphone invalide" });
      }
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post(api.auth.verifyOtp.path, async (req, res) => {
    try {
      console.log('🔐 Backend - verifyOtp called');
      console.log('📦 Body:', req.body);
      
      const input = api.auth.verifyOtp.input.parse(req.body);
      
      if (input.otp !== "123456") {
        return res.status(401).json({ message: "Code invalide" });
      }
  
      let user = await storage.getUserByPhone(input.phone);
      if (!user) {
        user = await storage.createUser({ 
          phone: input.phone, 
          name: "User " + input.phone.slice(-4), 
          role: "PASSENGER", 
          language: "mg" 
        });
      }
  
      req.session.userId = user.id;
      req.session.role = user.role;
      
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            console.error('❌ Session save error:', err);
            reject(err);
          } else {
            console.log('✅ Session saved successfully');
            resolve();
          }
        });
      });
  
      console.log('✅ User authenticated:', user.id, user.role);
      
      res.json({ user, success: true });
      
    } catch (e) {
      console.error('❌ Backend error:', e);
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: "Données invalides" });
      }
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.get(api.auth.me.path, async (req, res) => {
    console.log('👤 Backend - getMe called');
    
    if (!req.session.userId) {
      return res.status(401).json({ message: "Non authentifié" });
    }
    
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "Utilisateur non trouvé" });
    }
    
    res.json(user);
  });

  app.post(api.auth.logout.path, (req, res) => {
    console.log('🚪 Backend - logout called');
    
    req.session.destroy((err) => {
      if (err) {
        console.error('❌ Logout error:', err);
        return res.status(500).json({ message: "Erreur lors de la déconnexion" });
      }
      res.json({ message: "Déconnexion réussie" });
    });
  });

  // ==================== DEBUG ROUTES ====================
  
  app.get('/api/debug/session', (req, res) => {
    res.json({
      sessionId: req.session.id,
      userId: req.session.userId,
      role: req.session.role,
      cookie: req.session.cookie
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

  app.get('/api/driver/:id/location', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    const driverId = parseInt(req.params.id);
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

  app.post(api.passenger.acceptOffer.path, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = parseInt(req.params.id);
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
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    const profile = await storage.getDriverProfile(req.session.userId);
    if (!profile) return res.status(404).json({ message: "Profile not found" });
    res.json({ ...profile, documents: [] });
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
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post('/api/rides/:id/eta', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    
    const id = parseInt(req.params.id);
    const { additionalMinutes } = req.body;
    
    try {
      const ride = await storage.updateRideEta(id, additionalMinutes);
      res.json(ride);
    } catch (error) {
      res.status(400).json({ message: "Failed to update ETA" });
    }
  });

  app.post(api.driver.uploadDocument.path, upload.single('file'), async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    const docType = req.body.type || 'PHOTO';

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
  });

  // ==================== ADMIN ROUTES ====================

  app.get('/api/admin/stats', async (req, res) => {
    console.log('📊 Admin stats called');
    
    if (!req.session.userId) {
      return res.status(401).json({ message: "Non authentifié" });
    }
    
    if (req.session.role !== 'ADMIN') {
      return res.status(403).json({ message: "Accès refusé - rôle incorrect" });
    }
    
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      console.error('❌ Error getting stats:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.get(api.admin.getDrivers.path, async (req, res) => {
    if (!req.session.userId || req.session.role !== 'ADMIN') {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    try {
      const drivers = await storage.getDriversWithDetails();
      res.json(drivers);
    } catch (error) {
      console.error('❌ Error getting drivers:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post(api.admin.updateDriverStatus.path, async (req, res) => {
    if (!req.session.userId || req.session.role !== 'ADMIN') return res.status(403).json({ message: "Forbidden" });
    const id = parseInt(req.params.id);
    try {
      const input = api.admin.updateDriverStatus.input.parse(req.body);
      const status = input.action === "APPROVE" ? "APPROVED" : input.action === "REJECT" ? "REJECTED" : "SUSPENDED";
      const profile = await storage.updateDriverStatus(id, status);
      res.json(profile);
    } catch (e) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.get(api.admin.getUsers.path, async (req, res) => {
    if (!req.session.userId || req.session.role !== 'ADMIN') {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    try {
      const allUsers = await storage.getAllUsers();
      res.json(allUsers);
    } catch (error) {
      console.error('❌ Error getting users:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.get(api.admin.getRides.path, async (req, res) => {
    if (!req.session.userId || req.session.role !== 'ADMIN') {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    try {
      const ridesData = await storage.getRidesWithDetails();
      res.json(ridesData);
    } catch (error) {
      console.error('❌ Error getting rides:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post('/api/admin/users/:id/block', async (req, res) => {
    if (!req.session.userId || req.session.role !== 'ADMIN') return res.status(403).json({ message: "Forbidden" });
    const id = parseInt(req.params.id);
    const { blocked } = req.body;
    const user = await storage.blockUser(id, blocked);
    res.json(user);
  });

  app.post('/api/admin/rides/:id/cancel', async (req, res) => {
    if (!req.session.userId || req.session.role !== 'ADMIN') return res.status(403).json({ message: "Forbidden" });
    const id = parseInt(req.params.id);
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
    if (!req.session.userId || req.session.role !== 'ADMIN') {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    try {
      const config = await storage.getConfig();
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

  // ==================== ADVERTISEMENT ROUTES ====================

  // GET - Récupérer toutes les publicités actives (pour les utilisateurs)
  app.get('/api/ads', async (req, res) => {
    try {
      const { screen, userRole } = req.query;
      
      let query = db.select().from(advertisements)
        .where(eq(advertisements.isActive, true))
        .orderBy(sql`${advertisements.priority} DESC`);
      
      // Filtrer par écran
      if (screen && typeof screen === 'string') {
        query = query.where(eq(advertisements.position, screen));
      }
      
      // Filtrer par date
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
      
      // Filtrer par audience
      if (userRole && typeof userRole === 'string') {
        query = query.where(
          or(
            eq(advertisements.targetAudience, 'ALL'),
            eq(advertisements.targetAudience, userRole)
          )
        );
      }
      
      const ads = await query;
      
      // Enregistrer les impressions en arrière-plan
      if (req.session.userId && ads.length > 0) {
        for (const ad of ads) {
          await db.insert(adStats).values({
            adId: ad.id,
            userId: req.session.userId,
            action: 'IMPRESSION',
            screen: screen as string || 'UNKNOWN',
          });
        }
      }
      
      res.json(ads);
    } catch (error) {
      console.error('❌ Error fetching ads:', error);
      res.status(500).json({ message: "Erreur lors du chargement des publicités" });
    }
  });

  // GET - Récupérer toutes les publicités (admin)
  app.get('/api/admin/ads', async (req, res) => {
    console.log('📢 Admin getAds called');
    
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

  // GET - Récupérer une publicité spécifique (admin)
  app.get('/api/admin/ads/:id', async (req, res) => {
    if (!req.session.userId || req.session.role !== 'ADMIN') {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    const id = parseInt(req.params.id);
    try {
      const [ad] = await db.select().from(advertisements).where(eq(advertisements.id, id));
      if (!ad) {
        return res.status(404).json({ message: "Publicité non trouvée" });
      }
      res.json(ad);
    } catch (error) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // POST - Créer une publicité (admin)
  app.post('/api/admin/ads', adUpload.single('image'), async (req, res) => {
    console.log('📢 Creating ad - body:', req.body);
    console.log('📢 Creating ad - file:', req.file);
    
    if (!req.session.userId || req.session.role !== 'ADMIN') {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    try {
      const { title, titleFr, description, descriptionFr, linkUrl, type, position, priority, startDate, endDate, targetAudience } = req.body;
      
      // Validation
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
      }).returning();
      
      console.log('✅ Ad created:', newAd);
      res.status(201).json(newAd);
    } catch (error) {
      console.error('❌ Error creating ad:', error);
      res.status(500).json({ message: "Erreur lors de la création: " + (error as Error).message });
    }
  });

  // PUT - Mettre à jour une publicité (admin)
  app.put('/api/admin/ads/:id', adUpload.single('image'), async (req, res) => {
    console.log('📢 Updating ad - body:', req.body);
    console.log('📢 Updating ad - file:', req.file);
    
    if (!req.session.userId || req.session.role !== 'ADMIN') {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    const id = parseInt(req.params.id);
    
    try {
      const { title, titleFr, description, descriptionFr, linkUrl, type, position, priority, startDate, endDate, isActive, targetAudience } = req.body;
      
      // Validation
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
      
      console.log('✅ Ad updated:', updatedAd);
      res.json(updatedAd);
    } catch (error) {
      console.error('❌ Error updating ad:', error);
      res.status(500).json({ message: "Erreur lors de la mise à jour: " + (error as Error).message });
    }
  });

  // DELETE - Supprimer une publicité (admin)
  app.delete('/api/admin/ads/:id', async (req, res) => {
    if (!req.session.userId || req.session.role !== 'ADMIN') {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    const id = parseInt(req.params.id);
    
    try {
      await db.delete(advertisements).where(eq(advertisements.id, id));
      res.json({ message: "Publicité supprimée" });
    } catch (error) {
      console.error('❌ Error deleting ad:', error);
      res.status(500).json({ message: "Erreur lors de la suppression" });
    }
  });

  // POST - Enregistrer un clic sur une publicité
  app.post('/api/ads/:id/click', async (req, res) => {
    const id = parseInt(req.params.id);
    
    try {
      // Enregistrer le clic
      if (req.session.userId) {
        await db.insert(adStats).values({
          adId: id,
          userId: req.session.userId,
          action: 'CLICK',
          screen: req.body.screen || 'UNKNOWN',
        });
      }
      
      // Incrémenter le compteur de clics
      await db.update(advertisements)
        .set({ clickCount: sql`${advertisements.clickCount} + 1` })
        .where(eq(advertisements.id, id));
      
      // Récupérer l'URL de redirection
      const [ad] = await db.select().from(advertisements).where(eq(advertisements.id, id));
      
      res.json({ linkUrl: ad?.linkUrl });
    } catch (error) {
      console.error('❌ Error recording ad click:', error);
      res.status(500).json({ message: "Erreur" });
    }
  });

  // GET - Statistiques des publicités (admin)
  app.get('/api/admin/ads/:id/stats', async (req, res) => {
    if (!req.session.userId || req.session.role !== 'ADMIN') {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    const id = parseInt(req.params.id);
    
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
      
      const impressionsByScreen = await db.select({
        screen: adStats.screen,
        count: sql<number>`count(*)`
      })
      .from(adStats)
      .where(and(
        eq(adStats.adId, id),
        eq(adStats.action, 'IMPRESSION')
      ))
      .groupBy(adStats.screen);
      
      res.json({
        impressions: Number(impressions[0]?.count || 0),
        clicks: Number(clicks[0]?.count || 0),
        ctr: Number(clicks[0]?.count || 0) / Number(impressions[0]?.count || 1) * 100,
        impressionsByScreen,
      });
    } catch (error) {
      console.error('❌ Error getting ad stats:', error);
      res.status(500).json({ message: "Erreur" });
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
    await storage.markAsRead(parseInt(req.params.id), req.session.userId);
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
    const { name, nameFr, lat, lng } = req.body;
    if (!name || !nameFr || !lat || !lng) return res.status(400).json({ message: "Missing fields" });
    const place = await storage.updateCustomPlace(id, { name, nameFr, lat: String(lat), lng: String(lng) });
    res.json(place);
  });

  app.delete('/api/admin/places/:id', async (req, res) => {
    if (!req.session.role || req.session.role !== 'ADMIN') return res.status(403).json({ message: "Forbidden" });
    const id = parseInt(req.params.id);
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