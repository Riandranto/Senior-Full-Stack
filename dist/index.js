var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/utils/logger.ts
import { randomUUID } from "crypto";
function createContextLogger(context) {
  const requestId = randomUUID();
  const contextStr = typeof context === "string" ? context : JSON.stringify(context);
  return {
    fatal: (msg, ...args) => logger.fatal(`[${contextStr}] ${msg}`, ...args),
    error: (msg, ...args) => {
      if (msg instanceof Error) {
        logger.error(`[${contextStr}] ${msg.message}`, msg.stack, ...args);
      } else {
        logger.error(`[${contextStr}] ${msg}`, ...args);
      }
    },
    warn: (msg, ...args) => logger.warn(`[${contextStr}] ${msg}`, ...args),
    info: (msg, ...args) => logger.info(`[${contextStr}] ${msg}`, ...args),
    debug: (msg, ...args) => logger.debug(`[${contextStr}] ${msg}`, ...args),
    trace: (msg, ...args) => logger.trace(`[${contextStr}] ${msg}`, ...args),
    getRequestId: () => requestId
  };
}
var logger;
var init_logger = __esm({
  "server/utils/logger.ts"() {
    "use strict";
    logger = {
      info: (...args) => console.log("[INFO]", (/* @__PURE__ */ new Date()).toISOString(), ...args),
      error: (...args) => console.error("[ERROR]", (/* @__PURE__ */ new Date()).toISOString(), ...args),
      warn: (...args) => console.warn("[WARN]", (/* @__PURE__ */ new Date()).toISOString(), ...args),
      debug: (...args) => console.debug("[DEBUG]", (/* @__PURE__ */ new Date()).toISOString(), ...args),
      fatal: (...args) => console.error("[FATAL]", (/* @__PURE__ */ new Date()).toISOString(), ...args),
      trace: (...args) => console.trace("[TRACE]", (/* @__PURE__ */ new Date()).toISOString(), ...args)
    };
  }
});

// server/services/redis.ts
var redis_exports = {};
__export(redis_exports, {
  initializeRedis: () => initializeRedis,
  redisStore: () => redisStore
});
import { createClient } from "redis";
import RedisStore from "connect-redis";
async function initializeRedis() {
  if (!redisClient) {
    logger.info("Redis not configured, skipping initialization");
    return false;
  }
  try {
    await redisClient.connect();
    logger.info("Redis initialized successfully");
    return true;
  } catch (error) {
    logger.error({ error }, "Failed to initialize Redis");
    return false;
  }
}
var redisClient, redisStore, REDIS_URL;
var init_redis = __esm({
  "server/services/redis.ts"() {
    "use strict";
    init_logger();
    redisClient = null;
    redisStore = null;
    REDIS_URL = process.env.REDIS_URL || process.env.REDIS_TLS_URL;
    if (REDIS_URL) {
      redisClient = createClient({
        url: REDIS_URL,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.error("Redis max retries reached");
              return new Error("Redis max retries reached");
            }
            return Math.min(retries * 100, 3e3);
          }
        }
      });
      redisClient.on("error", (err) => {
        logger.error({ err }, "Redis Client Error");
      });
      redisClient.on("connect", () => {
        logger.info("Redis Client Connected");
      });
      redisStore = new RedisStore({
        client: redisClient,
        prefix: "farady:session:",
        ttl: 86400
      });
    } else {
      logger.info("REDIS_URL not set, using memory store fallback");
    }
  }
});

// server/index.ts
import "dotenv/config";
import express2 from "express";
import session2 from "express-session";
import createMemoryStore2 from "memorystore";
import rateLimit from "express-rate-limit";

// server/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  GEOCENTER: () => GEOCENTER,
  MAX_RADIUS_KM: () => MAX_RADIUS_KM,
  WS_EVENTS: () => WS_EVENTS,
  adStats: () => adStats,
  advertisements: () => advertisements,
  appConfig: () => appConfig,
  auditLogs: () => auditLogs,
  bookingOffers: () => bookingOffers,
  bookings: () => bookings,
  calculateDistance: () => calculateDistance,
  chatMessages: () => chatMessages,
  customPlaces: () => customPlaces,
  driverDocuments: () => driverDocuments,
  driverLocations: () => driverLocations,
  driverProfiles: () => driverProfiles,
  insertBookingOfferSchema: () => insertBookingOfferSchema,
  insertBookingSchema: () => insertBookingSchema,
  insertChatMessageSchema: () => insertChatMessageSchema,
  insertDriverLocationSchema: () => insertDriverLocationSchema,
  insertDriverProfileSchema: () => insertDriverProfileSchema,
  insertOfferSchema: () => insertOfferSchema,
  insertPassengerDocumentSchema: () => insertPassengerDocumentSchema,
  insertRideSchema: () => insertRideSchema,
  insertUserSchema: () => insertUserSchema,
  isWithinRange: () => isWithinRange,
  notifications: () => notifications,
  offers: () => offers,
  passengerDocuments: () => passengerDocuments,
  rides: () => rides,
  users: () => users
});
import { pgTable, text, serial, integer, boolean, timestamp, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var GEOCENTER = { lat: -18.8792, lng: 47.5079 };
var MAX_RADIUS_KM = 50;
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
function isWithinRange(lat, lng) {
  return calculateDistance(lat, lng, GEOCENTER.lat, GEOCENTER.lng) <= MAX_RADIUS_KM;
}
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull().default("PASSENGER"),
  language: text("language").notNull().default("mg"),
  otpAuth: text("otp_auth"),
  isBlocked: boolean("is_blocked").notNull().default(false),
  idCardUrl: text("id_card_url"),
  isApproved: boolean("is_approved").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow()
});
var driverProfiles = pgTable("driver_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  vehicleType: text("vehicle_type").notNull(),
  vehicleNumber: text("vehicle_number"),
  licenseNumber: text("license_number"),
  status: text("status").notNull().default("PENDING"),
  online: boolean("online").notNull().default(false),
  zone: text("zone"),
  ratingAvg: numeric("rating_avg", { precision: 3, scale: 2 }).default("0.00"),
  ratingCount: integer("rating_count").default(0)
});
var driverDocuments = pgTable("driver_documents", {
  id: serial("id").primaryKey(),
  driverId: integer("driver_id").references(() => driverProfiles.id),
  type: text("type").notNull(),
  url: text("url").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow()
});
var passengerDocuments = pgTable("passenger_documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  url: text("url").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow()
});
var rides = pgTable("rides", {
  id: serial("id").primaryKey(),
  passengerId: integer("passenger_id").notNull().references(() => users.id),
  driverId: integer("driver_id").references(() => users.id),
  status: text("status").notNull().default("REQUESTED"),
  pickupLat: numeric("pickup_lat", { precision: 10, scale: 7 }).notNull(),
  pickupLng: numeric("pickup_lng", { precision: 10, scale: 7 }).notNull(),
  pickupAddress: text("pickup_address").notNull(),
  dropLat: numeric("drop_lat", { precision: 10, scale: 7 }).notNull(),
  dropLng: numeric("drop_lng", { precision: 10, scale: 7 }).notNull(),
  dropAddress: text("drop_address").notNull(),
  distanceKm: numeric("distance_km", { precision: 6, scale: 2 }),
  etaMinutes: integer("eta_minutes"),
  selectedPriceAr: integer("selected_price_ar"),
  cancelBy: text("cancel_by"),
  cancelReason: text("cancel_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  vehicleType: text("vehicle_type").notNull().default("TAXI"),
  note: text("note"),
  isBooking: boolean("is_booking").notNull().default(false),
  bookingId: integer("booking_id")
});
var offers = pgTable("offers", {
  id: serial("id").primaryKey(),
  rideId: integer("ride_id").notNull().references(() => rides.id),
  driverId: integer("driver_id").notNull().references(() => users.id),
  priceAr: integer("price_ar").notNull(),
  etaMinutes: integer("eta_minutes").notNull(),
  message: text("message"),
  status: text("status").notNull().default("SENT"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
var bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  passengerId: integer("passenger_id").notNull().references(() => users.id),
  driverId: integer("driver_id").references(() => users.id),
  status: text("status").notNull().default("PENDING"),
  pickupLat: numeric("pickup_lat", { precision: 10, scale: 7 }).notNull(),
  pickupLng: numeric("pickup_lng", { precision: 10, scale: 7 }).notNull(),
  pickupAddress: text("pickup_address").notNull(),
  dropLat: numeric("drop_lat", { precision: 10, scale: 7 }).notNull(),
  dropLng: numeric("drop_lng", { precision: 10, scale: 7 }).notNull(),
  dropAddress: text("drop_address").notNull(),
  vehicleType: text("vehicle_type").notNull(),
  scheduledFor: timestamp("scheduled_for").notNull(),
  estimatedPriceAr: integer("estimated_price_ar"),
  finalPriceAr: integer("final_price_ar"),
  distanceKm: numeric("distance_km", { precision: 6, scale: 2 }),
  etaMinutes: integer("eta_minutes"),
  note: text("note"),
  cancelBy: text("cancel_by"),
  cancelReason: text("cancel_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var bookingOffers = pgTable("booking_offers", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  driverId: integer("driver_id").notNull().references(() => users.id),
  priceAr: integer("price_ar").notNull(),
  etaMinutes: integer("eta_minutes").notNull(),
  message: text("message"),
  status: text("status").notNull().default("SENT"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
var driverLocations = pgTable("driver_locations", {
  id: serial("id").primaryKey(),
  driverId: integer("driver_id").notNull().references(() => users.id),
  lat: numeric("lat", { precision: 10, scale: 7 }).notNull(),
  lng: numeric("lng", { precision: 10, scale: 7 }).notNull(),
  timestamp: timestamp("timestamp").defaultNow()
});
var auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow()
});
var notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull().default("INFO"),
  isRead: boolean("is_read").notNull().default(false),
  rideId: integer("ride_id"),
  createdAt: timestamp("created_at").defaultNow()
});
var customPlaces = pgTable("custom_places", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameFr: text("name_fr").notNull(),
  lat: numeric("lat", { precision: 10, scale: 7 }).notNull(),
  lng: numeric("lng", { precision: 10, scale: 7 }).notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
var appConfig = pgTable("app_config", {
  id: serial("id").primaryKey(),
  searchRadiusKm: numeric("search_radius_km", { precision: 5, scale: 2 }).notNull().default("5.0"),
  offerExpirySeconds: integer("offer_expiry_seconds").notNull().default(90),
  commissionPercent: numeric("commission_percent", { precision: 5, scale: 2 }).notNull().default("0.0")
});
var advertisements = pgTable("advertisements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  titleFr: text("title_fr").notNull(),
  description: text("description"),
  descriptionFr: text("description_fr"),
  imageUrl: text("image_url").notNull(),
  linkUrl: text("link_url"),
  type: text("type").notNull().default("BANNER"),
  position: text("position").default("HOME_TOP"),
  priority: integer("priority").default(0),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").default(true),
  impressionCount: integer("impression_count").default(0),
  clickCount: integer("click_count").default(0),
  targetAudience: text("target_audience"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var adStats = pgTable("ad_stats", {
  id: serial("id").primaryKey(),
  adId: integer("ad_id").references(() => advertisements.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(),
  screen: text("screen"),
  createdAt: timestamp("created_at").defaultNow()
});
var chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  rideId: integer("ride_id").notNull().references(() => rides.id, { onDelete: "cascade" }),
  senderId: integer("sender_id").notNull().references(() => users.id),
  receiverId: integer("receiver_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow()
});
var insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
var insertDriverProfileSchema = createInsertSchema(driverProfiles).omit({ id: true });
var insertRideSchema = createInsertSchema(rides).omit({ id: true, createdAt: true, updatedAt: true });
var insertOfferSchema = createInsertSchema(offers).omit({ id: true, createdAt: true });
var insertDriverLocationSchema = createInsertSchema(driverLocations).omit({ id: true, timestamp: true });
var insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true });
var insertPassengerDocumentSchema = createInsertSchema(passengerDocuments).omit({ id: true, uploadedAt: true });
var insertBookingSchema = createInsertSchema(bookings).omit({ id: true, createdAt: true, updatedAt: true });
var insertBookingOfferSchema = createInsertSchema(bookingOffers).omit({ id: true, createdAt: true });
var WS_EVENTS = {
  RIDE_NEW_REQUEST: "ride:new_request",
  OFFER_NEW: "offer:new",
  OFFER_EXPIRED: "offer:expired",
  OFFER_ACCEPTED: "offer:accepted",
  RIDE_STATUS_CHANGED: "ride:status_changed",
  DRIVER_LOCATION: "driver:location",
  CHAT_MESSAGE: "CHAT_MESSAGE",
  BOOKING_NEW: "booking:new",
  BOOKING_OFFER_NEW: "booking_offer:new",
  BOOKING_OFFER_ACCEPTED: "booking_offer:accepted",
  BOOKING_STATUS_CHANGED: "booking:status_changed"
};

// server/db.ts
var { Pool } = pg;
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}
console.log("\u{1F4E1} Connecting to database via HTTP pooling...");
var poolConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? {
    rejectUnauthorized: false
    // Pour Render
  } : false
  // Railway n'a pas besoin de configuration spéciale
};
var pool = new Pool(poolConfig);
async function connectWithRetry() {
  try {
    const client = await pool.connect();
    console.log("\u2705 Connected to database");
    client.release();
  } catch (err) {
    console.error("\u274C Connection failed:", err.message);
  }
}
connectWithRetry().catch((err) => {
  console.error("\u274C Failed to connect to database");
  console.error("\u{1F4A1} Essayez la solution avec Docker/PgBouncer ci-dessous");
});
var db = drizzle(pool, { schema: schema_exports });

// server/storage.ts
import { eq, and, or, sql } from "drizzle-orm";
var DatabaseStorage = class {
  // ==================== CONFIG ====================
  async getConfig() {
    const configs = await db.select().from(appConfig);
    if (configs.length === 0) {
      const [newConfig] = await db.insert(appConfig).values({
        searchRadiusKm: "5.0",
        offerExpirySeconds: 90,
        commissionPercent: "0.0"
      }).returning();
      return newConfig;
    }
    return configs[0];
  }
  async updateConfig(config) {
    const existing = await this.getConfig();
    const [updated] = await db.update(appConfig).set({
      searchRadiusKm: config.searchRadiusKm?.toString(),
      offerExpirySeconds: config.offerExpirySeconds,
      commissionPercent: config.commissionPercent?.toString()
    }).where(eq(appConfig.id, existing.id)).returning();
    return updated;
  }
  // ==================== USERS ====================
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  async getUserByPhone(phone) {
    const [user] = await db.select().from(users).where(eq(users.phone, phone));
    return user;
  }
  async createUser(insertUser) {
    const [user] = await db.insert(users).values({
      phone: insertUser.phone,
      name: insertUser.name,
      role: insertUser.role || "PASSENGER",
      language: insertUser.language || "mg"
    }).returning();
    return user;
  }
  async updateUserRole(id, role) {
    const [user] = await db.update(users).set({ role }).where(eq(users.id, id)).returning();
    return user;
  }
  async updateUser(id, update) {
    const [user] = await db.update(users).set(update).where(eq(users.id, id)).returning();
    return user;
  }
  // ==================== DRIVERS ====================
  async getDriverProfile(userId) {
    const [profile] = await db.select().from(driverProfiles).where(eq(driverProfiles.userId, userId));
    return profile;
  }
  async getDriverProfileById(profileId) {
    const [profile] = await db.select().from(driverProfiles).where(eq(driverProfiles.id, profileId));
    return profile;
  }
  async createDriverProfile(profile) {
    const [newProfile] = await db.insert(driverProfiles).values({
      userId: profile.userId,
      vehicleType: profile.vehicleType,
      vehicleNumber: profile.vehicleNumber,
      licenseNumber: profile.licenseNumber,
      status: profile.status || "PENDING",
      online: profile.online || false
    }).returning();
    return newProfile;
  }
  async updateDriverStatus(id, status) {
    const [profile] = await db.update(driverProfiles).set({ status }).where(eq(driverProfiles.id, id)).returning();
    return profile;
  }
  async updateDriverOnline(userId, online) {
    const [profile] = await db.update(driverProfiles).set({ online }).where(eq(driverProfiles.userId, userId)).returning();
    return profile;
  }
  async updateDriverOnlineByProfileId(profileId, online) {
    const [profile] = await db.update(driverProfiles).set({ online }).where(eq(driverProfiles.id, profileId)).returning();
    return profile;
  }
  async getPendingDrivers() {
    return await db.select().from(driverProfiles).where(eq(driverProfiles.status, "PENDING"));
  }
  async getAllDrivers() {
    return await db.select().from(driverProfiles);
  }
  async getAllUsers() {
    return await db.select().from(users);
  }
  // ==================== RIDES ====================
  async createRide(ride) {
    const [newRide] = await db.insert(rides).values({
      passengerId: ride.passengerId,
      status: ride.status || "REQUESTED",
      pickupLat: ride.pickupLat,
      pickupLng: ride.pickupLng,
      pickupAddress: ride.pickupAddress,
      dropLat: ride.dropLat,
      dropLng: ride.dropLng,
      dropAddress: ride.dropAddress,
      vehicleType: ride.vehicleType,
      note: ride.note,
      distanceKm: ride.distanceKm,
      etaMinutes: ride.etaMinutes
    }).returning();
    return newRide;
  }
  async getRide(id) {
    const [ride] = await db.select().from(rides).where(eq(rides.id, id));
    return ride;
  }
  async updateRideStatus(id, status) {
    const [ride] = await db.update(rides).set({ status, updatedAt: /* @__PURE__ */ new Date() }).where(eq(rides.id, id)).returning();
    return ride;
  }
  async cancelRide(id, reason, cancelBy) {
    const [ride] = await db.update(rides).set({
      status: "CANCELED",
      cancelReason: reason,
      cancelBy,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(rides.id, id)).returning();
    const otherUserId = cancelBy === "PASSENGER" ? ride.driverId : ride.passengerId;
    if (otherUserId) {
      await this.createNotification({
        userId: otherUserId,
        title: "Nofoanana ny dia",
        message: `Ny ${cancelBy === "PASSENGER" ? "mpandeha" : "mpamily"} dia nanafoana ny dia. Antony: ${reason}`,
        type: "RIDE_CANCELED",
        rideId: id
      });
    }
    if (cancelBy === "DRIVER") {
      await db.update(rides).set({ driverId: null, status: "REQUESTED" }).where(eq(rides.id, id));
    }
    return ride;
  }
  async acceptOffer(rideId, offerId, price, driverId) {
    await db.update(offers).set({ status: "ACCEPTED" }).where(eq(offers.id, offerId));
    await db.update(offers).set({ status: "EXPIRED" }).where(and(
      eq(offers.rideId, rideId),
      sql`${offers.id} != ${offerId}`
    ));
    const [ride] = await db.update(rides).set({
      status: "ASSIGNED",
      driverId,
      selectedPriceAr: price,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(rides.id, rideId)).returning();
    const passenger = await this.getUser(ride.passengerId);
    await this.createNotification({
      userId: driverId,
      title: "Tolobidy voaray!",
      message: `${passenger?.name || "Mpandeha"} dia nanaiky ny tolobidy Ar ${price}`,
      type: "OFFER_ACCEPTED",
      rideId
    });
    await this.createNotification({
      userId: ride.passengerId,
      title: "Tolobidy voaray!",
      message: `Ny mpamily ${(await this.getUser(driverId))?.name || "Mpamily"} dia nanaiky ny tolobidy Ar ${price}`,
      type: "OFFER_ACCEPTED",
      rideId
    });
    return ride;
  }
  async getPassengerRides(passengerId) {
    return await db.select().from(rides).where(eq(rides.passengerId, passengerId)).orderBy(sql`${rides.createdAt} DESC`);
  }
  async getRideHistory(userId) {
    try {
      const result = await db.select().from(rides).where(sql`${rides.passengerId} = ${userId} OR ${rides.driverId} = ${userId}`).orderBy(sql`${rides.createdAt} DESC`);
      return result;
    } catch (error) {
      console.error("Error in getRideHistory:", error);
      return [];
    }
  }
  async getNearbyRequests(lat, lng) {
    const allRequests = await db.select().from(rides).where(or(eq(rides.status, "REQUESTED"), eq(rides.status, "BIDDING"))).orderBy(sql`${rides.createdAt} DESC`);
    return allRequests;
  }
  async getAllRides() {
    return await db.select().from(rides).orderBy(sql`${rides.createdAt} DESC`);
  }
  // ==================== OFFERS ====================
  async createOffer(offer) {
    const [newOffer] = await db.insert(offers).values({
      rideId: offer.rideId,
      driverId: offer.driverId,
      priceAr: offer.priceAr,
      etaMinutes: offer.etaMinutes,
      message: offer.message,
      expiresAt: offer.expiresAt
    }).returning();
    await db.update(rides).set({ status: "BIDDING" }).where(and(eq(rides.id, offer.rideId), eq(rides.status, "REQUESTED")));
    return newOffer;
  }
  async getOffersForRide(rideId) {
    return await db.select().from(offers).where(and(eq(offers.rideId, rideId), or(eq(offers.status, "SENT"), eq(offers.status, "ACCEPTED"))));
  }
  // ==================== NOTIFICATIONS ====================
  async createNotification(notif) {
    const [n] = await db.insert(notifications).values({
      userId: notif.userId,
      title: notif.title,
      message: notif.message,
      type: notif.type || "INFO",
      rideId: notif.rideId
    }).returning();
    return n;
  }
  async getNotifications(userId) {
    return await db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(sql`${notifications.createdAt} DESC`).limit(50);
  }
  async getUnreadCount(userId) {
    const result = await db.select({ count: sql`count(*)` }).from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return Number(result[0]?.count || 0);
  }
  async markAsRead(id, userId) {
    await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
  }
  async markAllAsRead(userId) {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
  }
  // ==================== ADMIN STATS ====================
  async getAdminStats() {
    const [userCount] = await db.select({ count: sql`count(*)` }).from(users);
    const [driverCount] = await db.select({ count: sql`count(*)` }).from(driverProfiles);
    const [rideCount] = await db.select({ count: sql`count(*)` }).from(rides);
    const [activeCount] = await db.select({ count: sql`count(*)` }).from(rides).where(
      or(eq(rides.status, "REQUESTED"), eq(rides.status, "BIDDING"), eq(rides.status, "ASSIGNED"), eq(rides.status, "DRIVER_EN_ROUTE"), eq(rides.status, "DRIVER_ARRIVED"), eq(rides.status, "IN_PROGRESS"))
    );
    const [completedCount] = await db.select({ count: sql`count(*)` }).from(rides).where(eq(rides.status, "COMPLETED"));
    const [canceledCount] = await db.select({ count: sql`count(*)` }).from(rides).where(eq(rides.status, "CANCELED"));
    const [onlineCount] = await db.select({ count: sql`count(*)` }).from(driverProfiles).where(eq(driverProfiles.online, true));
    const [pendingCount] = await db.select({ count: sql`count(*)` }).from(driverProfiles).where(eq(driverProfiles.status, "PENDING"));
    const [revenueResult] = await db.select({ total: sql`COALESCE(SUM(selected_price_ar), 0)` }).from(rides).where(eq(rides.status, "COMPLETED"));
    return {
      totalUsers: Number(userCount.count),
      totalDrivers: Number(driverCount.count),
      totalRides: Number(rideCount.count),
      activeRides: Number(activeCount.count),
      completedRides: Number(completedCount.count),
      canceledRides: Number(canceledCount.count),
      onlineDrivers: Number(onlineCount.count),
      pendingDrivers: Number(pendingCount.count),
      totalRevenue: Number(revenueResult.total)
    };
  }
  async getRidesWithDetails() {
    const allRides = await db.select().from(rides).orderBy(sql`${rides.createdAt} DESC`).limit(200);
    const results = [];
    for (const r of allRides) {
      try {
        const passenger = await this.getUser(r.passengerId);
        const driver = r.driverId ? await this.getUser(r.driverId) : null;
        const rideOffers = await db.select().from(offers).where(eq(offers.rideId, r.id));
        results.push({ ...r, passenger, driver, offers: rideOffers });
      } catch (err) {
        console.error(`Error processing ride ${r.id}:`, err);
        results.push({ ...r, passenger: null, driver: null, offers: [] });
      }
    }
    return results;
  }
  async getDriversWithDetails() {
    try {
      console.log("\u{1F50D} Fetching drivers with details...");
      const allProfiles = await db.select().from(driverProfiles);
      console.log(`\u{1F4CB} Found ${allProfiles.length} driver profiles`);
      const results = [];
      for (const p of allProfiles) {
        try {
          const user = await this.getUser(p.userId);
          if (!user) {
            console.warn(`\u26A0\uFE0F User not found for driver profile ${p.id} (userId: ${p.userId})`);
            continue;
          }
          const docs = await db.select().from(driverDocuments).where(eq(driverDocuments.driverId, p.id));
          const driverRides = await db.select().from(rides).where(eq(rides.driverId, p.userId));
          const completedRides = driverRides.filter((r) => r.status === "COMPLETED");
          const totalEarnings = completedRides.reduce((sum, r) => sum + (r.selectedPriceAr || 0), 0);
          results.push({
            ...user,
            profile: p,
            documents: docs,
            totalRides: driverRides.length,
            completedRides: completedRides.length,
            totalEarnings
          });
        } catch (err) {
          console.error(`\u274C Error processing driver profile ${p.id}:`, err);
        }
      }
      console.log(`\u2705 Total drivers with details: ${results.length}`);
      return results;
    } catch (error) {
      console.error("\u274C Error in getDriversWithDetails:", error);
      return [];
    }
  }
  async blockUser(id, blocked) {
    const [user] = await db.update(users).set({ isBlocked: blocked }).where(eq(users.id, id)).returning();
    return user;
  }
  async adminCancelRide(id, reason) {
    const [ride] = await db.update(rides).set({
      status: "CANCELED",
      cancelReason: reason,
      cancelBy: "ADMIN",
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(rides.id, id)).returning();
    return ride;
  }
  async getDriverDocuments(driverId) {
    try {
      return await db.select().from(driverDocuments).where(eq(driverDocuments.driverId, driverId));
    } catch (error) {
      console.error("Error in getDriverDocuments:", error);
      return [];
    }
  }
  async createDriverDocument(doc) {
    const [result] = await db.insert(driverDocuments).values({
      driverId: doc.driverId,
      type: doc.type,
      url: doc.url
    }).returning();
    return result;
  }
  async getAllOffers() {
    return await db.select().from(offers).orderBy(sql`${offers.createdAt} DESC`);
  }
  async rateDriver(driverUserId, rating) {
    const profile = await this.getDriverProfile(driverUserId);
    if (!profile) return;
    const newCount = (profile.ratingCount || 0) + 1;
    const currentAvg = parseFloat(profile.ratingAvg || "0");
    const newAvg = (currentAvg * (newCount - 1) + rating) / newCount;
    await db.update(driverProfiles).set({
      ratingAvg: newAvg.toFixed(2),
      ratingCount: newCount
    }).where(eq(driverProfiles.userId, driverUserId));
  }
  // ==================== PASSENGER DOCUMENTS ====================
  async getPassengerDocuments(userId) {
    return await db.select().from(passengerDocuments).where(eq(passengerDocuments.userId, userId)).orderBy(sql`${passengerDocuments.uploadedAt} DESC`);
  }
  async createPassengerDocument(userId, type, url) {
    const [doc] = await db.insert(passengerDocuments).values({
      userId,
      type,
      url
    }).returning();
    return doc;
  }
  async deletePassengerDocument(id, userId) {
    await db.delete(passengerDocuments).where(and(
      eq(passengerDocuments.id, id),
      eq(passengerDocuments.userId, userId)
    ));
  }
  // ==================== BOOKINGS ====================
  async createBooking(booking) {
    const [newBooking] = await db.insert(bookings).values({
      passengerId: booking.passengerId,
      status: booking.status || "PENDING",
      pickupLat: booking.pickupLat,
      pickupLng: booking.pickupLng,
      pickupAddress: booking.pickupAddress,
      dropLat: booking.dropLat,
      dropLng: booking.dropLng,
      dropAddress: booking.dropAddress,
      vehicleType: booking.vehicleType,
      scheduledFor: booking.scheduledFor,
      note: booking.note,
      distanceKm: booking.distanceKm,
      etaMinutes: booking.etaMinutes,
      estimatedPriceAr: booking.estimatedPriceAr
    }).returning();
    return newBooking;
  }
  async getBooking(id) {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
    return booking;
  }
  async getPassengerBookings(userId) {
    return await db.select().from(bookings).where(eq(bookings.passengerId, userId)).orderBy(sql`${bookings.scheduledFor} DESC`);
  }
  async getDriverBookings(driverId) {
    return await db.select().from(bookings).where(eq(bookings.driverId, driverId)).orderBy(sql`${bookings.scheduledFor} ASC`);
  }
  async getAvailableBookings() {
    return await db.select().from(bookings).where(and(
      eq(bookings.status, "PENDING"),
      sql`${bookings.scheduledFor} > NOW()`
    )).orderBy(sql`${bookings.scheduledFor} ASC`);
  }
  async getAllBookings() {
    return await db.select().from(bookings).orderBy(sql`${bookings.scheduledFor} DESC`);
  }
  async updateBookingStatus(id, status, driverId) {
    const updateData = { status, updatedAt: /* @__PURE__ */ new Date() };
    if (driverId !== void 0) updateData.driverId = driverId;
    const [booking] = await db.update(bookings).set(updateData).where(eq(bookings.id, id)).returning();
    return booking;
  }
  async cancelBooking(id, reason, cancelBy) {
    const [booking] = await db.update(bookings).set({
      status: "CANCELED",
      cancelReason: reason,
      cancelBy,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(bookings.id, id)).returning();
    return booking;
  }
  async createBookingOffer(offer) {
    const [newOffer] = await db.insert(bookingOffers).values({
      bookingId: offer.bookingId,
      driverId: offer.driverId,
      priceAr: offer.priceAr,
      etaMinutes: offer.etaMinutes,
      message: offer.message,
      expiresAt: offer.expiresAt
    }).returning();
    return newOffer;
  }
  async getBookingOffers(bookingId) {
    return await db.select().from(bookingOffers).where(eq(bookingOffers.bookingId, bookingId)).orderBy(sql`${bookingOffers.createdAt} DESC`);
  }
  async acceptBookingOffer(bookingId, offerId) {
    await db.update(bookingOffers).set({ status: "ACCEPTED" }).where(eq(bookingOffers.id, offerId));
    await db.update(bookingOffers).set({ status: "EXPIRED" }).where(and(
      eq(bookingOffers.bookingId, bookingId),
      sql`${bookingOffers.id} != ${offerId}`
    ));
    const [offer] = await db.select().from(bookingOffers).where(eq(bookingOffers.id, offerId));
    const [booking] = await db.update(bookings).set({
      status: "CONFIRMED",
      driverId: offer.driverId,
      finalPriceAr: offer.priceAr,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(bookings.id, bookingId)).returning();
    return booking;
  }
  // ==================== CUSTOM PLACES ====================
  async getCustomPlaces() {
    return await db.select().from(customPlaces).orderBy(sql`${customPlaces.name} ASC`);
  }
  async createCustomPlace(place) {
    const [result] = await db.insert(customPlaces).values(place).returning();
    return result;
  }
  async updateCustomPlace(id, place) {
    const [result] = await db.update(customPlaces).set(place).where(eq(customPlaces.id, id)).returning();
    return result;
  }
  async deleteCustomPlace(id) {
    await db.delete(customPlaces).where(eq(customPlaces.id, id));
  }
  async createRideFromBooking(bookingId, driverId) {
    const booking = await this.getBooking(bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }
    const [ride] = await db.insert(rides).values({
      passengerId: booking.passengerId,
      driverId,
      status: "ASSIGNED",
      pickupLat: booking.pickupLat,
      pickupLng: booking.pickupLng,
      pickupAddress: booking.pickupAddress,
      dropLat: booking.dropLat,
      dropLng: booking.dropLng,
      dropAddress: booking.dropAddress,
      vehicleType: booking.vehicleType,
      distanceKm: booking.distanceKm,
      etaMinutes: booking.etaMinutes,
      selectedPriceAr: booking.finalPriceAr || booking.estimatedPriceAr,
      isBooking: true,
      bookingId: booking.id,
      note: booking.note
    }).returning();
    return ride;
  }
  // ==================== ADDITIONAL ====================
  async getDriverActiveRide(driverId) {
    const [ride] = await db.select().from(rides).where(and(
      eq(rides.driverId, driverId),
      or(
        eq(rides.status, "ASSIGNED"),
        eq(rides.status, "DRIVER_EN_ROUTE"),
        eq(rides.status, "DRIVER_ARRIVED"),
        eq(rides.status, "IN_PROGRESS")
      )
    )).orderBy(sql`${rides.createdAt} DESC`).limit(1);
    return ride;
  }
  async updateRideEta(id, additionalMinutes) {
    const ride = await this.getRide(id);
    if (!ride) throw new Error("Ride not found");
    const currentEta = ride.etaMinutes || 0;
    const newEta = currentEta + additionalMinutes;
    const [updated] = await db.update(rides).set({ etaMinutes: newEta, updatedAt: /* @__PURE__ */ new Date() }).where(eq(rides.id, id)).returning();
    return updated;
  }
};
var storage = new DatabaseStorage();

// shared/routes.ts
import { z } from "zod";
var errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional()
  }),
  notFound: z.object({
    message: z.string()
  }),
  internal: z.object({
    message: z.string()
  }),
  unauthorized: z.object({
    message: z.string()
  })
};
var userSchema = z.custom();
var driverProfileSchema = z.custom();
var rideSchema = z.custom();
var offerSchema = z.custom();
var configSchema = z.custom();
var documentSchema = z.custom();
var api = {
  auth: {
    requestOtp: {
      path: "/api/auth/request-otp",
      method: "POST",
      input: z.object({ phone: z.string() })
    },
    verifyOtp: {
      path: "/api/auth/verify-otp",
      method: "POST",
      input: z.object({ phone: z.string(), otp: z.string() })
    },
    me: {
      path: "/api/auth/me",
      method: "GET"
    },
    logout: {
      path: "/api/auth/logout",
      method: "POST"
    }
  },
  passenger: {
    createRide: {
      method: "POST",
      path: "/api/rides",
      input: z.object({
        pickupLat: z.number(),
        pickupLng: z.number(),
        pickupAddress: z.string(),
        dropLat: z.number(),
        dropLng: z.number(),
        dropAddress: z.string(),
        vehicleType: z.string(),
        note: z.string().optional()
      }),
      responses: {
        201: rideSchema,
        400: errorSchemas.validation
      }
    },
    getRide: {
      method: "GET",
      path: "/api/rides/:id",
      responses: {
        200: rideSchema.and(z.object({ driver: userSchema.optional() })),
        404: errorSchemas.notFound
      }
    },
    history: {
      method: "GET",
      path: "/api/rides",
      responses: {
        200: z.array(rideSchema)
      }
    },
    cancelRide: {
      method: "POST",
      path: "/api/rides/:id/cancel",
      input: z.object({ reason: z.string() }),
      responses: {
        200: rideSchema,
        400: errorSchemas.validation
      }
    },
    rateRide: {
      method: "POST",
      path: "/api/rides/:id/rate",
      input: z.object({ rating: z.number().min(1).max(5), comment: z.string().optional() }),
      responses: {
        200: z.object({ message: z.string() })
      }
    },
    acceptOffer: {
      method: "POST",
      path: "/api/rides/:id/accept-offer",
      input: z.object({ offerId: z.number() }),
      responses: {
        200: rideSchema,
        400: errorSchemas.validation
      }
    },
    getOffers: {
      method: "GET",
      path: "/api/rides/:id/offers",
      responses: {
        200: z.array(offerSchema.and(z.object({ driver: userSchema, profile: driverProfileSchema })))
      }
    }
  },
  driver: {
    uploadDocument: {
      method: "POST",
      path: "/api/driver/documents",
      // Input is FormData, returning document info
      responses: {
        201: documentSchema
      }
    },
    getProfile: {
      method: "GET",
      path: "/api/driver/profile",
      responses: {
        200: driverProfileSchema.and(z.object({ documents: z.array(documentSchema) })),
        404: errorSchemas.notFound
      }
    },
    setOnline: {
      method: "POST",
      path: "/api/driver/online",
      input: z.object({ online: z.boolean() }),
      responses: {
        200: driverProfileSchema
      }
    },
    getRequests: {
      method: "GET",
      path: "/api/driver/requests",
      responses: {
        200: z.array(rideSchema.and(z.object({ passenger: userSchema })))
      }
    },
    sendOffer: {
      method: "POST",
      path: "/api/offers",
      input: z.object({
        rideId: z.number(),
        priceAr: z.number(),
        etaMinutes: z.number(),
        message: z.string().optional()
      }),
      responses: {
        201: offerSchema,
        400: errorSchemas.validation
      }
    },
    updateRideStatus: {
      method: "POST",
      path: "/api/rides/:id/status",
      input: z.object({
        status: z.enum([
          "DRIVER_EN_ROUTE",
          // 🔥 AJOUTÉ
          "DRIVER_ARRIVED",
          "IN_PROGRESS",
          "COMPLETED"
        ])
      }),
      responses: {
        200: rideSchema,
        400: errorSchemas.validation
      }
    },
    updateLocation: {
      method: "POST",
      path: "/api/driver/location",
      input: z.object({ lat: z.number(), lng: z.number() }),
      responses: {
        200: z.object({ success: z.boolean() })
      }
    }
  },
  admin: {
    getDrivers: {
      method: "GET",
      path: "/api/admin/drivers",
      input: z.object({ status: z.string().optional() }).optional(),
      responses: {
        200: z.array(userSchema.and(z.object({ profile: driverProfileSchema, documents: z.array(documentSchema) })))
      }
    },
    updateDriverStatus: {
      method: "POST",
      path: "/api/admin/drivers/:id/status",
      input: z.object({ action: z.enum(["APPROVE", "REJECT", "SUSPEND"]), reason: z.string().optional() }),
      responses: {
        200: driverProfileSchema
      }
    },
    getUsers: {
      method: "GET",
      path: "/api/admin/users",
      responses: {
        200: z.array(userSchema)
      }
    },
    getRides: {
      method: "GET",
      path: "/api/admin/rides",
      responses: {
        200: z.array(rideSchema)
      }
    },
    getConfig: {
      method: "GET",
      path: "/api/admin/config",
      responses: {
        200: configSchema
      }
    },
    updateConfig: {
      method: "POST",
      path: "/api/admin/config",
      input: z.object({
        searchRadiusKm: z.number(),
        offerExpirySeconds: z.number(),
        commissionPercent: z.number()
      }),
      responses: {
        200: configSchema
      }
    }
  }
};

// server/routes.ts
import { z as z2 } from "zod";
import { eq as eq2, and as and2, or as or2, sql as sql2 } from "drizzle-orm";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import express from "express";
import path from "path";
import fs from "fs";
var uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s/g, "_")}`)
});
var upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 10 * 1024 * 1024 }
});
var adUpload = multer({
  storage: uploadStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Seules les images sont accept\xE9es (JPEG, PNG, GIF, WEBP)"));
    }
  }
});
async function registerRoutes(httpServer2, app2) {
  app2.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
  app2.use((req, res, next) => {
    if (!req.session) {
      console.error("\u274C Session not initialized for request:", req.path);
      return res.status(500).json({ message: "Session not initialized" });
    }
    next();
  });
  const requireAuth = (req, res, next) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Non authentifi\xE9" });
    }
    next();
  };
  const requireAdmin = (req, res, next) => {
    if (!req.session?.userId || req.session?.role !== "ADMIN") {
      return res.status(403).json({ message: "Acc\xE8s refus\xE9" });
    }
    next();
  };
  const wss = new WebSocketServer({ noServer: true });
  httpServer2.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url || "", `http://${request.headers.host}`);
    if (url.pathname === "/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });
  const clients = /* @__PURE__ */ new Map();
  wss.on("connection", (ws, req) => {
    let userId = null;
    ws.on("message", async (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === "auth" && data.payload?.userId) {
          userId = data.payload.userId;
          clients.set(userId, ws);
          console.log(`\u2705 WebSocket authenticated for user ${userId}`);
        }
        if (data.type === "CHAT_MESSAGE" && userId) {
          const { rideId, message: msg, fromName, toUserId, timestamp: timestamp2 } = data.payload;
          try {
            const [savedMessage] = await db.insert(chatMessages).values({
              rideId,
              senderId: userId,
              receiverId: toUserId || 0,
              message: msg.trim(),
              isRead: false
            }).returning();
            const target = clients.get(toUserId);
            if (target && target.readyState === WebSocket.OPEN) {
              target.send(JSON.stringify({
                type: "CHAT_MESSAGE",
                payload: {
                  id: savedMessage.id,
                  rideId,
                  from: userId,
                  fromName: fromName || "Utilisateur",
                  message: msg,
                  timestamp: savedMessage.createdAt.toISOString()
                }
              }));
            }
            ws.send(JSON.stringify({
              type: "CHAT_MESSAGE_SENT",
              payload: {
                id: savedMessage.id,
                success: true
              }
            }));
          } catch (error) {
            console.error("\u274C Error saving chat message:", error);
            ws.send(JSON.stringify({
              type: "CHAT_MESSAGE_ERROR",
              payload: { error: "Failed to save message" }
            }));
          }
        }
      } catch (e) {
        console.error("\u274C WS error:", e);
      }
    });
    ws.on("close", () => {
      if (userId) {
        clients.delete(userId);
        console.log(`\u{1F50C} WebSocket closed for user ${userId}`);
      }
    });
  });
  const broadcastToDrivers = async (message) => {
    const drivers = await storage.getAllDrivers();
    const onlineDrivers = drivers.filter((d) => d.online);
    for (const d of onlineDrivers) {
      const ws = clients.get(d.userId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    }
  };
  const sendToUser = (userId, message) => {
    const ws = clients.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  };
  app2.get("/api/debug/env", (req, res) => {
    res.json({
      nodeEnv: process.env.NODE_ENV,
      hasSessionSecret: !!process.env.SESSION_SECRET,
      sessionId: req.sessionID,
      session: req.session
    });
  });
  app2.get("/api/debug/db", async (req, res) => {
    try {
      const result = await db.execute(sql2`SELECT NOW()`);
      const userCount = await db.select({ count: sql2`count(*)` }).from(users);
      res.json({
        connected: true,
        timestamp: result.rows[0],
        userCount: userCount[0].count,
        nodeEnv: process.env.NODE_ENV
      });
    } catch (error) {
      console.error("DB connection error:", error);
      res.status(500).json({
        connected: false,
        error: String(error)
      });
    }
  });
  app2.post(api.auth.requestOtp.path, async (req, res) => {
    try {
      console.log("\u{1F4DE} requestOtp called");
      const { phone } = req.body;
      if (!phone) {
        return res.status(400).json({ message: "Num\xE9ro requis" });
      }
      console.log(`\u{1F4F1} OTP pour ${phone}: 123456`);
      res.json({ message: "Code envoy\xE9", expiresIn: 300 });
    } catch (error) {
      console.error("requestOtp error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });
  app2.post(api.auth.verifyOtp.path, async (req, res) => {
    try {
      console.log("\u{1F510} verifyOtp called");
      console.log("Session ID avant:", req.sessionID);
      const { phone, otp } = req.body;
      if (!phone || !otp) {
        return res.status(400).json({ message: "Phone et OTP requis" });
      }
      if (otp !== "123456") {
        return res.status(401).json({ message: "Code invalide" });
      }
      let user = await storage.getUserByPhone(phone);
      if (!user) {
        console.log(`Cr\xE9ation utilisateur pour ${phone}`);
        user = await storage.createUser({
          phone,
          name: `User_${phone.slice(-4)}`,
          role: "PASSENGER"
        });
      }
      req.session.regenerate((err) => {
        if (err) {
          console.error("Regenerate error:", err);
          return res.status(500).json({ message: "Session error" });
        }
        req.session.userId = user.id;
        req.session.role = user.role;
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error("Save error:", saveErr);
            return res.status(500).json({ message: "Save error" });
          }
          console.log(`\u2705 Utilisateur ${user.id} connect\xE9`);
          console.log(`Session ID apr\xE8s: ${req.sessionID}`);
          res.json({
            user: {
              id: user.id,
              phone: user.phone,
              name: user.name,
              role: user.role
            },
            success: true
          });
        });
      });
    } catch (error) {
      console.error("verifyOtp error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });
  app2.get(api.auth.me.path, async (req, res) => {
    console.log("\u{1F464} getMe called");
    console.log("Session ID:", req.sessionID);
    console.log("Session userId:", req.session?.userId);
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Non authentifi\xE9" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "Utilisateur non trouv\xE9" });
    }
    res.json(user);
  });
  app2.post(api.auth.logout.path, (req, res) => {
    console.log("\u{1F6AA} logout called");
    req.session.destroy((err) => {
      if (err) {
        console.error("\u274C Logout error:", err);
        return res.status(500).json({ message: "Erreur lors de la d\xE9connexion" });
      }
      res.clearCookie("farady.sid");
      res.json({ message: "D\xE9connexion r\xE9ussie" });
    });
  });
  app2.get("/api/debug/session", (req, res) => {
    console.log("\u{1F50D} Debug session:");
    console.log("Session ID:", req.sessionID);
    console.log("Session user:", req.session?.userId);
    console.log("Session role:", req.session?.role);
    res.json({
      sessionId: req.sessionID,
      userId: req.session?.userId,
      role: req.session?.role,
      hasSession: !!req.session?.userId,
      cookie: req.headers.cookie
    });
  });
  app2.get("/api/debug/session-state", (req, res) => {
    res.json({
      sessionID: req.sessionID,
      userId: req.session.userId,
      role: req.session.role,
      cookie: req.session.cookie,
      cookieHeader: req.headers["cookie"],
      hasSession: !!req.session.userId,
      environment: process.env.NODE_ENV,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app2.get("/api/debug/paths", (req, res) => {
    const currentDir = process.cwd();
    const distPublic = path.join(currentDir, "dist", "public");
    let files = {};
    if (fs.existsSync(distPublic)) {
      files = fs.readdirSync(distPublic).reduce((acc, file) => {
        if (file === "assets") {
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
      env: process.env.NODE_ENV
    });
  });
  app2.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app2.get("/api/test", (req, res) => {
    res.json({
      message: "Backend is working!",
      time: (/* @__PURE__ */ new Date()).toISOString(),
      sessionId: req.session?.id,
      userId: req.session?.userId,
      environment: process.env.NODE_ENV
    });
  });
  app2.get("/api/chat/history/:rideId", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Non authentifi\xE9" });
    }
    const rideId = parseInt(req.params.rideId);
    if (isNaN(rideId)) {
      return res.status(400).json({ message: "ID de course invalide" });
    }
    try {
      const messages = await db.select().from(chatMessages).where(eq2(chatMessages.rideId, rideId)).orderBy(sql2`${chatMessages.createdAt} ASC`);
      await db.update(chatMessages).set({ isRead: true }).where(and2(
        eq2(chatMessages.rideId, rideId),
        eq2(chatMessages.receiverId, req.session.userId),
        eq2(chatMessages.isRead, false)
      ));
      const formattedMessages = messages.map((msg) => ({
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
      console.error("\u274C Error fetching chat history:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });
  app2.post("/api/chat/send", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Non authentifi\xE9" });
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
        isRead: false
      }).returning();
      const sender = await storage.getUser(req.session.userId);
      if (toUserId) {
        const wsClient = clients.get(toUserId);
        if (wsClient && wsClient.readyState === WebSocket.OPEN) {
          wsClient.send(JSON.stringify({
            type: "CHAT_MESSAGE",
            payload: {
              id: savedMessage.id,
              rideId,
              from: req.session.userId,
              fromName: sender?.name || "Utilisateur",
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
      console.error("\u274C Error saving message:", error);
      res.status(500).json({
        message: "Erreur serveur",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  app2.post("/api/chat/mark-read/:rideId", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Non authentifi\xE9" });
    }
    const rideId = parseInt(req.params.rideId);
    if (isNaN(rideId)) {
      return res.status(400).json({ message: "ID de course invalide" });
    }
    try {
      await db.update(chatMessages).set({ isRead: true }).where(and2(
        eq2(chatMessages.rideId, rideId),
        eq2(chatMessages.receiverId, req.session.userId),
        eq2(chatMessages.isRead, false)
      ));
      res.json({ success: true });
    } catch (error) {
      console.error("\u274C Error marking messages as read:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });
  app2.get("/api/ads", async (req, res) => {
    try {
      const { screen, userRole } = req.query;
      let query = db.select().from(advertisements).where(eq2(advertisements.isActive, true)).orderBy(sql2`${advertisements.priority} DESC`);
      if (screen && typeof screen === "string") {
        query = query.where(eq2(advertisements.position, screen));
      }
      const now = /* @__PURE__ */ new Date();
      query = query.where(
        or2(
          sql2`${advertisements.startDate} IS NULL`,
          sql2`${advertisements.startDate} <= ${now}`
        )
      );
      query = query.where(
        or2(
          sql2`${advertisements.endDate} IS NULL`,
          sql2`${advertisements.endDate} >= ${now}`
        )
      );
      if (userRole && typeof userRole === "string") {
        query = query.where(
          or2(
            eq2(advertisements.targetAudience, "ALL"),
            eq2(advertisements.targetAudience, userRole)
          )
        );
      }
      const ads = await query;
      if (req.session.userId && ads.length > 0) {
        for (const ad of ads) {
          await db.insert(adStats).values({
            adId: ad.id,
            userId: req.session.userId,
            action: "IMPRESSION",
            screen: screen || "UNKNOWN"
          }).catch((e) => console.error("Failed to record impression:", e));
        }
      }
      res.json(ads);
    } catch (error) {
      console.error("\u274C Error fetching ads:", error);
      res.status(500).json({ message: "Erreur lors du chargement des publicit\xE9s" });
    }
  });
  app2.get("/api/admin/ads", async (req, res) => {
    if (!req.session.userId || req.session.role !== "ADMIN") {
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      const ads = await db.select().from(advertisements).orderBy(sql2`${advertisements.createdAt} DESC`);
      res.json(ads);
    } catch (error) {
      console.error("\u274C Error getting ads:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });
  app2.post("/api/admin/ads", adUpload.single("image"), async (req, res) => {
    console.log("\u{1F4E2} Creating ad - body:", req.body);
    console.log("\u{1F4E2} Creating ad - file:", req.file);
    if (!req.session.userId || req.session.role !== "ADMIN") {
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
        type: type || "BANNER",
        position: position || "HOME_TOP",
        priority: parseInt(priority) || 0,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        isActive: true,
        targetAudience: targetAudience || "ALL",
        impressionCount: 0,
        clickCount: 0
      }).returning();
      console.log("\u2705 Ad created:", newAd);
      res.status(201).json(newAd);
    } catch (error) {
      console.error("\u274C Error creating ad:", error);
      res.status(500).json({ message: "Erreur lors de la cr\xE9ation" });
    }
  });
  app2.put("/api/admin/ads/:id", adUpload.single("image"), async (req, res) => {
    console.log("\u{1F4E2} Updating ad - body:", req.body);
    console.log("\u{1F4E2} Updating ad - file:", req.file);
    if (!req.session.userId || req.session.role !== "ADMIN") {
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
      const updateData = {
        title,
        titleFr,
        description: description || null,
        descriptionFr: descriptionFr || null,
        linkUrl: linkUrl || null,
        type: type || "BANNER",
        position: position || "HOME_TOP",
        priority: parseInt(priority) || 0,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        isActive: isActive === "true" || isActive === true,
        targetAudience: targetAudience || "ALL",
        updatedAt: /* @__PURE__ */ new Date()
      };
      if (req.file) {
        updateData.imageUrl = `/uploads/${req.file.filename}`;
      }
      const [updatedAd] = await db.update(advertisements).set(updateData).where(eq2(advertisements.id, id)).returning();
      console.log("\u2705 Ad updated:", updatedAd);
      res.json(updatedAd);
    } catch (error) {
      console.error("\u274C Error updating ad:", error);
      res.status(500).json({ message: "Erreur lors de la mise \xE0 jour" });
    }
  });
  app2.delete("/api/admin/ads/:id", async (req, res) => {
    if (!req.session.userId || req.session.role !== "ADMIN") {
      return res.status(403).json({ message: "Forbidden" });
    }
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID invalide" });
    }
    try {
      await db.delete(advertisements).where(eq2(advertisements.id, id));
      res.json({ message: "Publicit\xE9 supprim\xE9e" });
    } catch (error) {
      console.error("\u274C Error deleting ad:", error);
      res.status(500).json({ message: "Erreur lors de la suppression" });
    }
  });
  app2.post("/api/ads/:id/click", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID invalide" });
    }
    try {
      if (req.session.userId) {
        await db.insert(adStats).values({
          adId: id,
          userId: req.session.userId,
          action: "CLICK",
          screen: req.body.screen || "UNKNOWN"
        }).catch((e) => console.error("Failed to record click:", e));
      }
      await db.update(advertisements).set({ clickCount: sql2`${advertisements.clickCount} + 1` }).where(eq2(advertisements.id, id));
      const [ad] = await db.select().from(advertisements).where(eq2(advertisements.id, id));
      res.json({ linkUrl: ad?.linkUrl });
    } catch (error) {
      console.error("\u274C Error recording ad click:", error);
      res.status(500).json({ message: "Erreur" });
    }
  });
  app2.get("/api/admin/ads/:id/stats", async (req, res) => {
    if (!req.session.userId || req.session.role !== "ADMIN") {
      return res.status(403).json({ message: "Forbidden" });
    }
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID invalide" });
    }
    try {
      const impressions = await db.select({ count: sql2`count(*)` }).from(adStats).where(and2(
        eq2(adStats.adId, id),
        eq2(adStats.action, "IMPRESSION")
      ));
      const clicks = await db.select({ count: sql2`count(*)` }).from(adStats).where(and2(
        eq2(adStats.adId, id),
        eq2(adStats.action, "CLICK")
      ));
      const impressionsCount = Number(impressions[0]?.count || 0);
      const clicksCount = Number(clicks[0]?.count || 0);
      res.json({
        impressions: impressionsCount,
        clicks: clicksCount,
        ctr: impressionsCount > 0 ? clicksCount / impressionsCount * 100 : 0
      });
    } catch (error) {
      console.error("\u274C Error getting ad stats:", error);
      res.status(500).json({ message: "Erreur" });
    }
  });
  app2.post(api.passenger.createRide.path, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const input = api.passenger.createRide.input.parse(req.body);
      if (!isWithinRange(input.pickupLat, input.pickupLng) || !isWithinRange(input.dropLat, input.dropLng)) {
        return res.status(400).json({
          message: "Miala tsiny, tsy mbola misy ny Farady amin\u2019ity faritra ity."
        });
      }
      const distanceKm = input.distanceKm ?? calculateDistance(input.pickupLat, input.pickupLng, input.dropLat, input.dropLng);
      const etaMinutes = input.etaMinutes ?? Math.max(1, Math.round(distanceKm / 25 * 60));
      const ride = await storage.createRide({
        ...input,
        passengerId: req.session.userId,
        status: "REQUESTED",
        pickupLat: input.pickupLat.toString(),
        pickupLng: input.pickupLng.toString(),
        dropLat: input.dropLat.toString(),
        dropLng: input.dropLng.toString(),
        distanceKm: distanceKm.toFixed(2),
        etaMinutes
      });
      const user = await storage.getUser(req.session.userId);
      await broadcastToDrivers({
        type: WS_EVENTS.RIDE_NEW_REQUEST,
        payload: { ...ride, passenger: user }
      });
      res.status(201).json(ride);
    } catch (e) {
      if (e instanceof z2.ZodError) return res.status(400).json({ message: e.errors[0].message });
      console.error("\u274C Create ride error:", e);
      res.status(500).json({ message: "Internal error" });
    }
  });
  app2.get(api.passenger.getRide.path, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de course invalide" });
    }
    const ride = await storage.getRide(id);
    if (!ride) return res.status(404).json({ message: "Not found" });
    let driver = void 0;
    if (ride.driverId) {
      driver = await storage.getUser(ride.driverId);
    }
    res.json({ ...ride, driver });
  });
  app2.get(api.passenger.history.path, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    const rides2 = await storage.getRideHistory(req.session.userId);
    res.json(rides2);
  });
  app2.post(api.passenger.cancelRide.path, async (req, res) => {
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
  app2.get(api.passenger.getOffers.path, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de course invalide" });
    }
    const rideOffers = await storage.getOffersForRide(id);
    const enrichedOffers = await Promise.all(rideOffers.map(async (o) => {
      const driver = await storage.getUser(o.driverId);
      const profile = await storage.getDriverProfile(o.driverId);
      const locResult = await db.select().from(driverLocations).where(eq2(driverLocations.driverId, o.driverId)).orderBy(sql2`timestamp DESC`).limit(1);
      const location = locResult.length > 0 ? { lat: parseFloat(locResult[0].lat), lng: parseFloat(locResult[0].lng) } : null;
      return { ...o, driver, profile, location };
    }));
    res.json(enrichedOffers);
  });
  app2.get("/api/rides/:id/views", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    const onlineDrivers = await storage.getAllDrivers();
    const count = onlineDrivers.filter((d) => d.online).length;
    res.json({ viewCount: count });
  });
  app2.get("/api/rides/active", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Non authentifi\xE9" });
    }
    try {
      console.log(`\u{1F50D} Fetching active ride for user ${req.session.userId}`);
      const allRides = await storage.getRideHistory(req.session.userId);
      console.log(`\u{1F4CB} Found ${allRides.length} rides total`);
      const activeRide = allRides.find(
        (r) => r.status !== "COMPLETED" && r.status !== "CANCELED"
      );
      if (!activeRide) {
        console.log(`\u2139\uFE0F No active ride for user ${req.session.userId}`);
        return res.status(404).json({ message: "Aucune course active" });
      }
      console.log(`\u2705 Found active ride ${activeRide.id} with status ${activeRide.status}`);
      let otherUser = null;
      try {
        if (activeRide.driverId === req.session.userId) {
          otherUser = await storage.getUser(activeRide.passengerId);
          console.log(`\u{1F464} Passenger: ${otherUser?.name}`);
        } else if (activeRide.driverId) {
          otherUser = await storage.getUser(activeRide.driverId);
          console.log(`\u{1F464} Driver: ${otherUser?.name}`);
        }
      } catch (err) {
        console.error("Error fetching other user:", err);
      }
      const response = {
        ...activeRide,
        otherUser: otherUser || null,
        isDriver: activeRide.driverId === req.session.userId,
        passengerName: activeRide.driverId === req.session.userId ? otherUser?.name : void 0,
        passengerPhone: activeRide.driverId === req.session.userId ? otherUser?.phone : void 0,
        driverName: activeRide.driverId !== req.session.userId ? otherUser?.name : void 0,
        driverPhone: activeRide.driverId !== req.session.userId ? otherUser?.phone : void 0
      };
      res.json(response);
    } catch (error) {
      console.error("\u274C Error fetching active ride:", error);
      res.status(500).json({
        message: "Erreur interne",
        error: process.env.NODE_ENV === "development" ? String(error) : void 0
      });
    }
  });
  app2.get("/api/driver/:id/location", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    const driverId = parseInt(req.params.id);
    if (isNaN(driverId)) {
      return res.status(400).json({ message: "ID de conducteur invalide" });
    }
    const locResult = await db.select().from(driverLocations).where(eq2(driverLocations.driverId, driverId)).orderBy(sql2`timestamp DESC`).limit(1);
    if (locResult.length > 0) {
      res.json({ lat: parseFloat(locResult[0].lat), lng: parseFloat(locResult[0].lng) });
    } else {
      res.json(null);
    }
  });
  app2.get("/api/driver/documents", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Non authentifi\xE9" });
    }
    try {
      console.log("\u{1F4C4} Fetching driver documents for user:", req.session.userId);
      const profile = await storage.getDriverProfile(req.session.userId);
      if (!profile) {
        console.log("\u2139\uFE0F No driver profile found for user:", req.session.userId);
        return res.json([]);
      }
      const docs = await storage.getDriverDocuments(profile.id);
      console.log(`\u2705 Found ${docs.length} driver documents`);
      res.json(docs);
    } catch (error) {
      console.error("\u274C Error fetching driver documents:", error);
      res.status(500).json({
        message: "Erreur serveur",
        error: process.env.NODE_ENV === "development" ? error.message : void 0
      });
    }
  });
  app2.post("/api/driver/register", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Non authentifi\xE9" });
    }
    try {
      const { vehicleType, vehicleNumber, licenseNumber } = req.body;
      let existingProfile = await storage.getDriverProfile(req.session.userId);
      if (existingProfile) {
        await storage.updateDriverStatus(existingProfile.id, "PENDING");
        await storage.updateDriverOnline(req.session.userId, false);
        await db.update(driverProfiles).set({
          vehicleNumber: vehicleNumber || existingProfile.vehicleNumber,
          licenseNumber: licenseNumber || existingProfile.licenseNumber,
          vehicleType: vehicleType || existingProfile.vehicleType,
          status: "PENDING"
        }).where(eq2(driverProfiles.id, existingProfile.id));
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
        online: false
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
      console.error("\u274C Error registering driver:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });
  app2.post(api.passenger.acceptOffer.path, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de course invalide" });
    }
    try {
      const input = api.passenger.acceptOffer.input.parse(req.body);
      const offer = (await storage.getOffersForRide(id)).find((o) => o.id === input.offerId);
      if (!offer) return res.status(404).json({ message: "Offer not found" });
      const ride = await storage.acceptOffer(id, input.offerId, offer.priceAr, offer.driverId);
      sendToUser(offer.driverId, { type: WS_EVENTS.OFFER_ACCEPTED, payload: ride });
      const passenger = await storage.getUser(req.session.userId);
      await storage.createNotification({
        userId: offer.driverId,
        title: "Tolobidy voaray!",
        message: `${passenger?.name || "Mpandeha"} dia nanaiky ny tolobidy Ar ${offer.priceAr}`,
        type: "OFFER_ACCEPTED",
        rideId: id
      });
      res.json(ride);
    } catch (e) {
      res.status(400).json({ message: "Invalid input" });
    }
  });
  app2.post(api.passenger.rateRide.path, async (req, res) => {
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
        rideId: id
      });
      res.json({ message: "Rating submitted" });
    } catch (e) {
      res.status(400).json({ message: "Invalid input" });
    }
  });
  app2.post(api.driver.setOnline.path, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const input = api.driver.setOnline.input.parse(req.body);
      const profile = await storage.updateDriverOnline(req.session.userId, input.online);
      res.json(profile);
    } catch (e) {
      res.status(400).json({ message: "Invalid input" });
    }
  });
  app2.get(api.driver.getProfile.path, async (req, res) => {
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
      console.error("\u274C Error fetching driver profile:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });
  app2.get(api.driver.getRequests.path, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    const rides2 = await storage.getNearbyRequests();
    const enrichedRides = await Promise.all(rides2.map(async (r) => {
      const passenger = await storage.getUser(r.passengerId);
      return { ...r, passenger };
    }));
    res.json(enrichedRides);
  });
  app2.post(api.driver.sendOffer.path, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const input = api.driver.sendOffer.input.parse(req.body);
      const offer = await storage.createOffer({
        ...input,
        driverId: req.session.userId,
        expiresAt: new Date(Date.now() + 9e4)
      });
      const ride = await storage.getRide(input.rideId);
      if (ride) {
        sendToUser(ride.passengerId, { type: WS_EVENTS.OFFER_NEW, payload: offer });
        const driver = await storage.getUser(req.session.userId);
        await storage.createNotification({
          userId: ride.passengerId,
          title: "Tolobidy vaovao",
          message: `${driver?.name || "Mpamily"} dia nanolotra Ar ${input.priceAr}`,
          type: "OFFER",
          rideId: input.rideId
        });
      }
      res.status(201).json(offer);
    } catch (e) {
      res.status(400).json({ message: "Invalid input" });
    }
  });
  app2.post(api.driver.updateRideStatus.path, async (req, res) => {
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
      const validTransitions = {
        "ASSIGNED": ["DRIVER_EN_ROUTE"],
        "DRIVER_EN_ROUTE": ["DRIVER_ARRIVED"],
        "DRIVER_ARRIVED": ["IN_PROGRESS"],
        "IN_PROGRESS": ["COMPLETED"]
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
  app2.post(api.driver.updateLocation.path, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const { lat, lng } = req.body;
      if (lat && lng) {
        await db.insert(driverLocations).values({
          driverId: req.session.userId,
          lat: lat.toString(),
          lng: lng.toString()
        });
        const activeRides = await db.select().from(rides).where(and2(
          eq2(rides.driverId, req.session.userId),
          or2(
            eq2(rides.status, "ASSIGNED"),
            eq2(rides.status, "DRIVER_EN_ROUTE"),
            eq2(rides.status, "DRIVER_ARRIVED"),
            eq2(rides.status, "IN_PROGRESS")
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
  app2.get("/api/driver/active-ride", async (req, res) => {
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
        passengerPhone: passenger?.phone
      });
    } catch (error) {
      console.error("Error fetching driver active ride:", error);
      res.status(500).json({ message: "Internal error" });
    }
  });
  app2.patch("/api/rides/:id/status", async (req, res) => {
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
      const validTransitions = {
        "PASSENGER": {
          "REQUESTED": ["CANCELED"],
          "BIDDING": ["CANCELED"],
          "ASSIGNED": ["CANCELED"]
        },
        "DRIVER": {
          "ASSIGNED": ["DRIVER_EN_ROUTE", "CANCELED"],
          "DRIVER_EN_ROUTE": ["DRIVER_ARRIVED", "CANCELED"],
          "DRIVER_ARRIVED": ["IN_PROGRESS", "CANCELED"],
          "IN_PROGRESS": ["COMPLETED", "CANCELED"]
        }
      };
      const userRole = req.session.role || (ride.driverId === req.session.userId ? "DRIVER" : "PASSENGER");
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
      console.error("\u274C Error updating ride status:", error);
      res.status(500).json({ message: "Internal error" });
    }
  });
  app2.post(api.driver.uploadDocument.path, upload.single("file"), async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const docType = req.body.type || "PHOTO";
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
      const fileUrl = req.file ? `/uploads/${req.file.filename}` : "";
      const doc = await storage.createDriverDocument({
        driverId: profile.id,
        type: docType,
        url: fileUrl
      });
      res.status(201).json(doc);
    } catch (error) {
      console.error("\u274C Error uploading driver document:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });
  app2.post("/api/rides/:id/eta", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de course invalide" });
    }
    const { additionalMinutes } = req.body;
    if (!additionalMinutes || additionalMinutes < 1 || additionalMinutes > 30) {
      return res.status(400).json({ message: "Minutes suppl\xE9mentaires invalides (1-30)" });
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
      const [updated] = await db.update(rides).set({ etaMinutes: newEta, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(rides.id, id)).returning();
      sendToUser(ride.passengerId, {
        type: WS_EVENTS.RIDE_STATUS_CHANGED,
        payload: updated
      });
      res.json(updated);
    } catch (error) {
      console.error("\u274C Error updating ETA:", error);
      res.status(500).json({ message: "Internal error" });
    }
  });
  app2.get("/api/admin/stats", async (req, res) => {
    console.log("\u{1F4CA} Admin stats called");
    if (!req.session.userId) {
      console.log("\u274C No userId in session");
      return res.status(401).json({ message: "Non authentifi\xE9" });
    }
    if (req.session.role !== "ADMIN") {
      console.log(`\u274C Forbidden - role is ${req.session.role}, expected ADMIN`);
      return res.status(403).json({ message: "Acc\xE8s refus\xE9 - r\xF4le incorrect" });
    }
    try {
      const stats = await storage.getAdminStats();
      console.log("\u2705 Stats retrieved successfully");
      res.json(stats);
    } catch (error) {
      console.error("\u274C Error getting stats:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });
  app2.get("/api/driver/documents", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Non authentifi\xE9" });
    }
    try {
      const profile = await storage.getDriverProfile(req.session.userId);
      if (!profile) {
        return res.json([]);
      }
      const docs = await storage.getDriverDocuments(profile.id);
      res.json(docs);
    } catch (error) {
      console.error("\u274C Error fetching driver documents:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });
  app2.get(api.admin.getDrivers.path, async (req, res) => {
    console.log("\u{1F465} Admin getDrivers called");
    console.log("\u{1F4CB} Session:", {
      userId: req.session?.userId,
      role: req.session?.role,
      sessionId: req.sessionID
    });
    if (!req.session.userId) {
      console.log("\u274C No userId in session");
      return res.status(401).json({ message: "Non authentifi\xE9" });
    }
    if (req.session.role !== "ADMIN") {
      console.log(`\u274C Forbidden - role is ${req.session.role}, expected ADMIN`);
      return res.status(403).json({ message: "Acc\xE8s refus\xE9 - r\xF4le incorrect" });
    }
    try {
      console.log("\u{1F504} Fetching drivers from storage...");
      const drivers = await storage.getDriversWithDetails();
      console.log(`\u2705 Successfully retrieved ${drivers.length} drivers`);
      if (drivers.length > 0) {
        console.log("\u{1F4CA} Sample driver:", {
          id: drivers[0].id,
          name: drivers[0].name,
          role: drivers[0].role,
          profileStatus: drivers[0].profile?.status,
          hasProfile: !!drivers[0].profile
        });
      } else {
        console.log("\u26A0\uFE0F No drivers found in database");
        const allProfiles = await db.select().from(driverProfiles);
        console.log(`\u{1F4CB} Total driver profiles in DB: ${allProfiles.length}`);
        if (allProfiles.length > 0) {
          console.log("\u{1F4CB} Profiles found but users might be missing:");
          for (const p of allProfiles) {
            const user = await storage.getUser(p.userId);
            console.log(`  - Profile ${p.id}: userId=${p.userId}, status=${p.status}, userExists=${!!user}`);
          }
        }
      }
      res.json(drivers);
    } catch (error) {
      console.error("\u274C Error getting drivers:", error);
      res.status(500).json({
        message: "Erreur serveur",
        error: process.env.NODE_ENV === "development" ? error.message : void 0
      });
    }
  });
  app2.post(api.admin.updateDriverStatus.path, async (req, res) => {
    if (!req.session.userId || req.session.role !== "ADMIN") return res.status(403).json({ message: "Forbidden" });
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
          console.log(`\u2705 User ${driverProfile.userId} reverted to PASSENGER after rejection`);
        }
      }
      if (input.action === "SUSPEND") {
        await storage.updateDriverOnlineByProfileId(id, false);
      }
      res.json(profile);
    } catch (e) {
      console.error("\u274C Error updating driver status:", e);
      res.status(400).json({ message: "Invalid input" });
    }
  });
  app2.get(api.admin.getUsers.path, async (req, res) => {
    console.log("\u{1F465} Admin getUsers called");
    if (!req.session.userId || req.session.role !== "ADMIN") {
      console.log("\u274C Forbidden - not admin");
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      const allUsers = await storage.getAllUsers();
      console.log(`\u2705 ${allUsers.length} users retrieved`);
      res.json(allUsers);
    } catch (error) {
      console.error("\u274C Error getting users:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });
  app2.get(api.admin.getRides.path, async (req, res) => {
    console.log("\u{1F697} Admin getRides called");
    if (!req.session.userId || req.session.role !== "ADMIN") {
      console.log("\u274C Forbidden - not admin");
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      const ridesData = await storage.getRidesWithDetails();
      console.log(`\u2705 ${ridesData.length} rides retrieved`);
      res.json(ridesData);
    } catch (error) {
      console.error("\u274C Error getting rides:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });
  app2.post("/api/admin/users/:id/block", async (req, res) => {
    if (!req.session.userId || req.session.role !== "ADMIN") return res.status(403).json({ message: "Forbidden" });
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID utilisateur invalide" });
    }
    const { blocked } = req.body;
    const user = await storage.blockUser(id, blocked);
    res.json(user);
  });
  app2.post("/api/admin/rides/:id/cancel", async (req, res) => {
    if (!req.session.userId || req.session.role !== "ADMIN") return res.status(403).json({ message: "Forbidden" });
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de course invalide" });
    }
    const { reason } = req.body;
    const ride = await storage.adminCancelRide(id, reason || "Cancelled by admin");
    res.json(ride);
  });
  app2.get("/api/admin/driver-locations", async (req, res) => {
    if (!req.session.userId || req.session.role !== "ADMIN") return res.status(403).json({ message: "Forbidden" });
    const locs = await db.execute(sql2`
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
  app2.get(api.admin.getConfig.path, async (req, res) => {
    console.log("\u2699\uFE0F Admin getConfig called");
    if (!req.session.userId || req.session.role !== "ADMIN") {
      console.log("\u274C Forbidden - not admin");
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      const config = await storage.getConfig();
      console.log("\u2705 Config retrieved");
      res.json(config);
    } catch (error) {
      console.error("\u274C Error getting config:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });
  app2.post(api.admin.updateConfig.path, async (req, res) => {
    if (!req.session.userId || req.session.role !== "ADMIN") return res.status(403).json({ message: "Forbidden" });
    try {
      const input = api.admin.updateConfig.input.parse(req.body);
      const config = await storage.updateConfig(input);
      res.json(config);
    } catch (e) {
      res.status(400).json({ message: "Invalid input" });
    }
  });
  app2.get("/api/notifications", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    const notifs = await storage.getNotifications(req.session.userId);
    res.json(notifs);
  });
  app2.get("/api/notifications/unread-count", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    const count = await storage.getUnreadCount(req.session.userId);
    res.json({ count });
  });
  app2.post("/api/notifications/:id/read", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de notification invalide" });
    }
    await storage.markAsRead(id, req.session.userId);
    res.json({ message: "ok" });
  });
  app2.post("/api/notifications/read-all", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    await storage.markAllAsRead(req.session.userId);
    res.json({ message: "ok" });
  });
  app2.post("/api/user/update", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    const { name } = req.body;
    const user = await storage.updateUser(req.session.userId, { name });
    res.json(user);
  });
  app2.get("/api/passenger/documents", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Non authentifi\xE9" });
    }
    try {
      console.log("\u{1F4C4} Fetching passenger documents for user:", req.session.userId);
      const docs = await db.select().from(passengerDocuments).where(eq2(passengerDocuments.userId, req.session.userId));
      console.log(`\u2705 Found ${docs.length} passenger documents`);
      res.json(docs);
    } catch (error) {
      console.error("\u274C Error fetching passenger documents:", error);
      res.status(500).json({
        message: "Erreur serveur",
        error: process.env.NODE_ENV === "development" ? error.message : void 0
      });
    }
  });
  app2.post("/api/passenger/documents", upload.single("file"), async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Non authentifi\xE9" });
    }
    try {
      const docType = req.body.type || "CIN";
      const fileUrl = req.file ? `/uploads/${req.file.filename}` : "";
      console.log("\u{1F4E4} Uploading passenger document:", { docType, fileUrl, userId: req.session.userId });
      if (!req.file) {
        return res.status(400).json({ message: "Aucun fichier fourni" });
      }
      const [doc] = await db.insert(passengerDocuments).values({
        userId: req.session.userId,
        type: docType,
        url: fileUrl,
        uploadedAt: /* @__PURE__ */ new Date()
      }).returning();
      await storage.updateUser(req.session.userId, {
        idCardUrl: fileUrl,
        isApproved: true
      });
      console.log("\u2705 Passenger document uploaded successfully:", doc.id);
      res.status(201).json(doc);
    } catch (error) {
      console.error("\u274C Error uploading passenger document:", error);
      res.status(500).json({
        message: "Erreur lors de l'upload",
        error: process.env.NODE_ENV === "development" ? error.message : void 0
      });
    }
  });
  app2.delete("/api/passenger/documents/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Non authentifi\xE9" });
    }
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de document invalide" });
    }
    try {
      console.log("\u{1F5D1}\uFE0F Deleting passenger document:", id);
      await db.delete(passengerDocuments).where(and2(
        eq2(passengerDocuments.id, id),
        eq2(passengerDocuments.userId, req.session.userId)
      ));
      console.log("\u2705 Passenger document deleted");
      res.json({ message: "Document supprim\xE9" });
    } catch (error) {
      console.error("\u274C Error deleting passenger document:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });
  app2.post("/api/bookings", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      console.log("\u{1F4C5} Creating booking with data:", req.body);
      const {
        pickupLat,
        pickupLng,
        pickupAddress,
        dropLat,
        dropLng,
        dropAddress,
        vehicleType,
        scheduledFor,
        note,
        distanceKm,
        etaMinutes,
        estimatedPriceAr
      } = req.body;
      if (!pickupLat || !pickupLng || !pickupAddress || !dropLat || !dropLng || !dropAddress || !vehicleType || !scheduledFor) {
        console.log("\u274C Missing required fields");
        return res.status(400).json({ message: "Champs requis manquants" });
      }
      if (!isWithinRange(pickupLat, pickupLng) || !isWithinRange(dropLat, dropLng)) {
        return res.status(400).json({
          message: "Miala tsiny, tsy mbola misy ny Farady amin\u2019ity faritra ity."
        });
      }
      const scheduledDate = new Date(scheduledFor);
      if (isNaN(scheduledDate.getTime())) {
        return res.status(400).json({ message: "Date invalide" });
      }
      if (scheduledDate <= /* @__PURE__ */ new Date()) {
        return res.status(400).json({ message: "La r\xE9servation doit \xEAtre dans le futur" });
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
        estimatedPriceAr: estimatedPriceAr || null
      }).returning();
      console.log("\u2705 Booking created:", booking.id);
      try {
        const passenger = await storage.getUser(req.session.userId);
        await broadcastToDrivers({
          type: WS_EVENTS.BOOKING_NEW,
          payload: { ...booking, passenger }
        });
      } catch (err) {
        console.error("Error broadcasting to drivers:", err);
      }
      res.status(201).json(booking);
    } catch (error) {
      console.error("\u274C Error creating booking:", error);
      res.status(500).json({
        message: "Erreur interne",
        error: process.env.NODE_ENV === "development" ? String(error) : void 0
      });
    }
  });
  app2.get("/api/bookings", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const userBookings = await db.select().from(bookings).where(eq2(bookings.passengerId, req.session.userId)).orderBy(sql2`${bookings.scheduledFor} DESC`);
      res.json(userBookings);
    } catch (error) {
      console.error("\u274C Error fetching bookings:", error);
      res.status(500).json({ message: "Erreur interne" });
    }
  });
  app2.get("/api/bookings/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de r\xE9servation invalide" });
    }
    try {
      const booking = await db.select().from(bookings).where(eq2(bookings.id, id)).limit(1);
      if (!booking.length) {
        return res.status(404).json({ message: "R\xE9servation non trouv\xE9e" });
      }
      const bookingData = booking[0];
      if (bookingData.passengerId !== req.session.userId && (!bookingData.driverId || bookingData.driverId !== req.session.userId) && req.session.role !== "ADMIN") {
        return res.status(403).json({ message: "Acc\xE8s non autoris\xE9" });
      }
      let driver = null;
      if (bookingData.driverId) {
        driver = await storage.getUser(bookingData.driverId);
      }
      const offers3 = await db.select().from(bookingOffers).where(eq2(bookingOffers.bookingId, id));
      res.json({ ...bookingData, driver, offers: offers3 });
    } catch (error) {
      console.error("\u274C Error fetching booking:", error);
      res.status(500).json({ message: "Erreur interne" });
    }
  });
  app2.post("/api/bookings/:id/offers", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (req.session.role !== "DRIVER") {
      return res.status(403).json({ message: "Seuls les conducteurs peuvent faire des offres" });
    }
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de r\xE9servation invalide" });
    }
    const { priceAr, etaMinutes, message } = req.body;
    if (!priceAr || !etaMinutes) {
      return res.status(400).json({ message: "Prix et ETA requis" });
    }
    try {
      const booking = await db.select().from(bookings).where(eq2(bookings.id, id)).limit(1);
      if (!booking.length) {
        return res.status(404).json({ message: "R\xE9servation non trouv\xE9e" });
      }
      const bookingData = booking[0];
      if (bookingData.status !== "PENDING") {
        return res.status(400).json({ message: "Cette r\xE9servation n'est plus disponible" });
      }
      if (bookingData.driverId === req.session.userId) {
        return res.status(400).json({ message: "Vous avez d\xE9j\xE0 accept\xE9 cette r\xE9servation" });
      }
      const existingOffer = await db.select().from(bookingOffers).where(and2(
        eq2(bookingOffers.bookingId, id),
        eq2(bookingOffers.driverId, req.session.userId),
        eq2(bookingOffers.status, "SENT")
      ));
      if (existingOffer.length) {
        return res.status(400).json({ message: "Vous avez d\xE9j\xE0 envoy\xE9 une offre" });
      }
      const [offer] = await db.insert(bookingOffers).values({
        bookingId: id,
        driverId: req.session.userId,
        priceAr,
        etaMinutes,
        message: message || null,
        expiresAt: new Date(Date.now() + 9e4)
      }).returning();
      const driver = await storage.getUser(req.session.userId);
      sendToUser(bookingData.passengerId, {
        type: WS_EVENTS.BOOKING_OFFER_NEW,
        payload: { ...offer, driver, booking: bookingData }
      });
      res.status(201).json(offer);
    } catch (error) {
      console.error("\u274C Error creating booking offer:", error);
      res.status(500).json({ message: "Erreur interne" });
    }
  });
  app2.post("/api/bookings/:id/accept-offer", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de r\xE9servation invalide" });
    }
    const { offerId } = req.body;
    try {
      const booking = await db.select().from(bookings).where(eq2(bookings.id, id)).limit(1);
      if (!booking.length) {
        return res.status(404).json({ message: "R\xE9servation non trouv\xE9e" });
      }
      const bookingData = booking[0];
      if (bookingData.passengerId !== req.session.userId) {
        return res.status(403).json({ message: "Non autoris\xE9" });
      }
      if (bookingData.status !== "PENDING") {
        return res.status(400).json({ message: "Cette r\xE9servation n'est plus disponible" });
      }
      const offer = await db.select().from(bookingOffers).where(eq2(bookingOffers.id, offerId)).limit(1);
      if (!offer.length || offer[0].bookingId !== id) {
        return res.status(404).json({ message: "Offre non trouv\xE9e" });
      }
      const offerData = offer[0];
      if (offerData.status !== "SENT") {
        return res.status(400).json({ message: "Cette offre n'est plus valide" });
      }
      if (/* @__PURE__ */ new Date() > offerData.expiresAt) {
        await db.update(bookingOffers).set({ status: "EXPIRED" }).where(eq2(bookingOffers.id, offerId));
        return res.status(400).json({ message: "L'offre a expir\xE9" });
      }
      await db.update(bookingOffers).set({ status: "ACCEPTED" }).where(eq2(bookingOffers.id, offerId));
      await db.update(bookingOffers).set({ status: "EXPIRED" }).where(and2(
        eq2(bookingOffers.bookingId, id),
        sql2`${bookingOffers.id} != ${offerId}`
      ));
      const [updatedBooking] = await db.update(bookings).set({
        status: "CONFIRMED",
        driverId: offerData.driverId,
        finalPriceAr: offerData.priceAr,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(bookings.id, id)).returning();
      const passenger = await storage.getUser(req.session.userId);
      sendToUser(offerData.driverId, {
        type: WS_EVENTS.BOOKING_OFFER_ACCEPTED,
        payload: { ...updatedBooking, passenger }
      });
      res.json(updatedBooking);
    } catch (error) {
      console.error("\u274C Error accepting booking offer:", error);
      res.status(500).json({ message: "Erreur interne" });
    }
  });
  app2.post("/api/bookings/:id/cancel", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de r\xE9servation invalide" });
    }
    const { reason } = req.body;
    try {
      const booking = await db.select().from(bookings).where(eq2(bookings.id, id)).limit(1);
      if (!booking.length) {
        return res.status(404).json({ message: "R\xE9servation non trouv\xE9e" });
      }
      const bookingData = booking[0];
      if (bookingData.passengerId !== req.session.userId && (!bookingData.driverId || bookingData.driverId !== req.session.userId) && req.session.role !== "ADMIN") {
        return res.status(403).json({ message: "Non autoris\xE9" });
      }
      if (bookingData.status === "COMPLETED" || bookingData.status === "CANCELED") {
        return res.status(400).json({ message: "Impossible d'annuler cette r\xE9servation" });
      }
      const cancelBy = req.session.role === "ADMIN" ? "ADMIN" : bookingData.driverId === req.session.userId ? "DRIVER" : "PASSENGER";
      const [cancelledBooking] = await db.update(bookings).set({
        status: "CANCELED",
        cancelBy,
        cancelReason: reason || null,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(bookings.id, id)).returning();
      const otherUserId = bookingData.passengerId === req.session.userId ? bookingData.driverId : bookingData.passengerId;
      if (otherUserId) {
        sendToUser(otherUserId, {
          type: WS_EVENTS.BOOKING_STATUS_CHANGED,
          payload: cancelledBooking
        });
      }
      res.json(cancelledBooking);
    } catch (error) {
      console.error("\u274C Error canceling booking:", error);
      res.status(500).json({ message: "Erreur interne" });
    }
  });
  app2.get("/api/driver/bookings", async (req, res) => {
    if (!req.session.userId || req.session.role !== "DRIVER") {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const availableBookings = await db.select().from(bookings).where(and2(
        eq2(bookings.status, "PENDING"),
        sql2`${bookings.scheduledFor} > NOW()`
      )).orderBy(sql2`${bookings.scheduledFor} ASC`);
      const enrichedBookings = await Promise.all(availableBookings.map(async (b) => {
        const passenger = await storage.getUser(b.passengerId);
        return { ...b, passenger };
      }));
      res.json(enrichedBookings);
    } catch (error) {
      console.error("\u274C Error fetching driver bookings:", error);
      res.status(500).json({ message: "Erreur interne" });
    }
  });
  app2.get("/api/driver/bookings/my", async (req, res) => {
    if (!req.session.userId || req.session.role !== "DRIVER") {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const myBookings = await db.select().from(bookings).where(and2(
        eq2(bookings.driverId, req.session.userId),
        sql2`${bookings.status} != 'CANCELED'`
      )).orderBy(sql2`${bookings.scheduledFor} ASC`);
      const enrichedBookings = await Promise.all(myBookings.map(async (b) => {
        const passenger = await storage.getUser(b.passengerId);
        return { ...b, passenger };
      }));
      res.json(enrichedBookings);
    } catch (error) {
      console.error("\u274C Error fetching my driver bookings:", error);
      res.status(500).json({ message: "Erreur interne" });
    }
  });
  app2.get("/api/admin/bookings", async (req, res) => {
    if (!req.session.userId || req.session.role !== "ADMIN") {
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      const allBookings = await storage.getAllBookings();
      const enrichedBookings = await Promise.all(allBookings.map(async (b) => {
        const passenger = await storage.getUser(b.passengerId);
        const driver = b.driverId ? await storage.getUser(b.driverId) : null;
        return { ...b, passenger, driver };
      }));
      res.json(enrichedBookings);
    } catch (error) {
      console.error("\u274C Error fetching bookings:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });
  app2.post("/api/admin/bookings/:id/cancel", async (req, res) => {
    if (!req.session.userId || req.session.role !== "ADMIN") {
      return res.status(403).json({ message: "Forbidden" });
    }
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de r\xE9servation invalide" });
    }
    const { reason } = req.body;
    try {
      const cancelledBooking = await storage.cancelBooking(id, reason || "Annul\xE9 par l'admin", "ADMIN");
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
      console.error("\u274C Error canceling booking:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });
  app2.get("/api/places", async (_req, res) => {
    const places = await storage.getCustomPlaces();
    res.json(places);
  });
  app2.get("/api/admin/places", async (req, res) => {
    if (!req.session.role || req.session.role !== "ADMIN") return res.status(403).json({ message: "Forbidden" });
    const places = await storage.getCustomPlaces();
    res.json(places);
  });
  app2.post("/api/admin/places", async (req, res) => {
    if (!req.session.role || req.session.role !== "ADMIN") return res.status(403).json({ message: "Forbidden" });
    const { name, nameFr, lat, lng } = req.body;
    if (!name || !nameFr || !lat || !lng) return res.status(400).json({ message: "Missing fields" });
    const place = await storage.createCustomPlace({ name, nameFr, lat: String(lat), lng: String(lng) });
    res.status(201).json(place);
  });
  app2.put("/api/admin/places/:id", async (req, res) => {
    if (!req.session.role || req.session.role !== "ADMIN") return res.status(403).json({ message: "Forbidden" });
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de lieu invalide" });
    }
    const { name, nameFr, lat, lng } = req.body;
    if (!name || !nameFr || !lat || !lng) return res.status(400).json({ message: "Missing fields" });
    const place = await storage.updateCustomPlace(id, { name, nameFr, lat: String(lat), lng: String(lng) });
    res.json(place);
  });
  app2.delete("/api/admin/places/:id", async (req, res) => {
    if (!req.session.role || req.session.role !== "ADMIN") return res.status(403).json({ message: "Forbidden" });
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de lieu invalide" });
    }
    await storage.deleteCustomPlace(id);
    res.json({ message: "Deleted" });
  });
  async function sendNotificationToUser(userId, title, message, type, rideId) {
    await storage.createNotification({
      userId,
      title,
      message,
      type,
      rideId
    });
    const ws = clients.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "NOTIFICATION",
        payload: {
          id: Date.now(),
          title,
          message,
          type,
          rideId,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          isRead: false
        }
      }));
    }
  }
  app2.post("/api/bookings/:id/start-ride", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (req.session.role !== "DRIVER") {
      return res.status(403).json({ message: "Seuls les conducteurs peuvent d\xE9marrer une r\xE9servation" });
    }
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de r\xE9servation invalide" });
    }
    try {
      const booking = await storage.getBooking(id);
      if (!booking) {
        return res.status(404).json({ message: "R\xE9servation non trouv\xE9e" });
      }
      if (booking.driverId !== req.session.userId) {
        return res.status(403).json({ message: "Vous n'\xEAtes pas le conducteur assign\xE9" });
      }
      if (booking.status !== "CONFIRMED") {
        return res.status(400).json({ message: "La r\xE9servation n'est pas confirm\xE9e" });
      }
      const scheduledFor = new Date(booking.scheduledFor);
      const now = /* @__PURE__ */ new Date();
      const hoursDiff = (scheduledFor.getTime() - now.getTime()) / (1e3 * 60 * 60);
      if (hoursDiff > 2) {
        return res.status(400).json({
          message: `Vous ne pouvez d\xE9marrer que 2h avant l'heure pr\xE9vue (${hoursDiff.toFixed(1)}h restantes)`
        });
      }
      const ride = await storage.createRideFromBooking(booking.id, req.session.userId);
      await storage.updateBookingStatus(id, "IN_PROGRESS", booking.driverId);
      sendToUser(booking.passengerId, {
        type: WS_EVENTS.RIDE_STATUS_CHANGED,
        payload: ride
      });
      res.status(201).json(ride);
    } catch (error) {
      console.error("\u274C Error starting ride from booking:", error);
      res.status(500).json({ message: "Erreur interne" });
    }
  });
  app2.get("/api/driver/bookings/upcoming", async (req, res) => {
    if (!req.session.userId || req.session.role !== "DRIVER") {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const bookings2 = await db.select().from(bookings2).where(and2(
        eq2(bookings2.driverId, req.session.userId),
        or2(
          eq2(bookings2.status, "CONFIRMED"),
          eq2(bookings2.status, "ASSIGNED")
        ),
        sql2`${bookings2.scheduledFor} > NOW() - INTERVAL '1 hour'`
      )).orderBy(sql2`${bookings2.scheduledFor} ASC`);
      const enriched = await Promise.all(bookings2.map(async (b) => {
        const passenger = await storage.getUser(b.passengerId);
        return { ...b, passenger };
      }));
      res.json(enriched);
    } catch (error) {
      console.error("\u274C Error fetching upcoming bookings:", error);
      res.status(500).json({ message: "Erreur interne" });
    }
  });
  async function seedDatabase() {
    try {
      const admin = await storage.getUserByPhone("0340000000");
      if (!admin) {
        await storage.createUser({ phone: "0340000000", name: "Admin Farady", role: "ADMIN" });
        console.log("\u2705 Admin user created");
      }
      const passenger = await storage.getUserByPhone("0341111111");
      if (!passenger) {
        await storage.createUser({ phone: "0341111111", name: "Rabe Passenger", role: "PASSENGER" });
        console.log("\u2705 Passenger user created");
      }
      const driver = await storage.getUserByPhone("0342222222");
      if (!driver) {
        const d = await storage.createUser({ phone: "0342222222", name: "Rakoto Driver", role: "DRIVER" });
        await storage.createDriverProfile({ userId: d.id, vehicleType: "TAXI", status: "APPROVED", online: true });
        console.log("\u2705 Driver user created");
      }
    } catch (error) {
      console.error("\u274C Error seeding database:", error);
    }
  }
  seedDatabase().catch(console.error);
  return httpServer2;
}

// server/index.ts
import { createServer } from "http";
import fs2 from "fs";
import path2 from "path";
import cors from "cors";

// server/services/session.ts
init_redis();
import session from "express-session";
import createMemoryStore from "memorystore";
var MemoryStore = createMemoryStore(session);
var isProduction = process.env.NODE_ENV === "production";
var redisAvailable = false;
var sessionConfig = {
  secret: process.env.SESSION_SECRET || "super-secret-key-change-in-production",
  resave: false,
  saveUninitialized: false,
  name: isProduction ? "__Secure-farady.sid" : "farady.sid",
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1e3,
    // 30 jours
    httpOnly: true,
    secure: isProduction,
    // Secure uniquement en HTTPS
    sameSite: isProduction ? "strict" : "lax",
    path: "/",
    domain: isProduction ? process.env.DOMAIN || ".ride-mada-mg.up.railway.app" : void 0
  },
  rolling: true,
  // Renouvelle le cookie à chaque requête
  proxy: isProduction
  // Trust proxy en production
};

// server/index.ts
init_logger();
var Sentry = null;
if (process.env.NODE_ENV === "production" && process.env.SENTRY_DSN) {
  try {
    const sentryModule = await import("@sentry/node");
    Sentry = sentryModule;
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.Express({ app })
      ],
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.1"),
      profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || "0.1"),
      environment: process.env.NODE_ENV,
      release: `ride-mada@${process.env.npm_package_version || "1.0.0"}`,
      beforeSend(event) {
        if (process.env.NODE_ENV === "development") return null;
        if (event.request?.data) {
          delete event.request.data.password;
          delete event.request.data.token;
        }
        return event;
      }
    });
    logger.info("\u2705 Sentry initialized for backend");
  } catch (err) {
    logger.warn("Failed to initialize Sentry:", err.message);
  }
}
var initializeRedis2 = async () => false;
var redisStore2 = null;
try {
  const redisModule = await Promise.resolve().then(() => (init_redis(), redis_exports));
  initializeRedis2 = redisModule.initializeRedis || (async () => false);
  redisStore2 = redisModule.redisStore || null;
  logger.info("\u2705 Redis module loaded");
} catch (err) {
  if (err.code === "ERR_MODULE_NOT_FOUND") {
    logger.info("\u2139\uFE0F Redis module not found, using MemoryStore only");
  } else {
    logger.warn("\u26A0\uFE0F Redis module import failed:", err.message);
  }
}
var app = express2();
var httpServer;
app.set("trust proxy", 1);
var isProduction2 = process.env.NODE_ENV === "production";
var MemoryStore2 = createMemoryStore2(session2);
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});
app.use(session2({
  name: "farady.sid",
  secret: process.env.SESSION_SECRET || "fallback-secret-key-change-this",
  resave: false,
  saveUninitialized: false,
  store: new MemoryStore2({ checkPeriod: 864e5 }),
  cookie: {
    secure: true,
    // Render utilise HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1e3,
    sameSite: "lax",
    // Pour le même domaine, 'lax' suffit
    path: "/"
  }
}));
logger.info("\u2705 Session middleware configured");
var limiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  max: 100,
  message: "Trop de requ\xEAtes"
});
app.use("/api", limiter);
app.use("/api", limiter);
var authLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  max: process.env.NODE_ENV === "development" ? 50 : 5,
  message: "Trop de tentatives de connexion, veuillez r\xE9essayer dans 15 minutes.",
  skipSuccessfulRequests: true
});
app.use("/uploads", express2.static(path2.join(process.cwd(), "uploads")));
app.use(express2.json({ limit: "20mb" }));
app.use(express2.urlencoded({ extended: false, limit: "20mb" }));
var allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://localhost:5000,https://senior-full-stack.onrender.com").split(",");
app.use(cors({
  origin: true,
  credentials: true
}));
app.use((req, res, next) => {
  if (isProduction2 && req.headers["x-forwarded-proto"] !== "https" && process.env.ENABLE_HTTPS !== "false") {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});
app.use((req, res, next) => {
  const startTime = Date.now();
  const reqLogger = createContextLogger({
    method: req.method,
    path: req.path,
    ip: req.ip
  });
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    reqLogger[logLevel](`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    if (isProduction2 && duration > 1e3) {
      reqLogger.warn(`Slow request detected`, { duration, statusCode: res.statusCode });
    }
  });
  next();
});
if (!isProduction2) {
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      logger.debug("Session Debug:", {
        path: req.path,
        sessionID: req.sessionID,
        hasSession: !!req.session,
        userId: req.session?.userId ? "present" : "absent"
      });
    }
    next();
  });
}
app.get("/api/test", (req, res) => {
  logger.info("Test endpoint called");
  res.json({
    message: "Backend is working!",
    time: (/* @__PURE__ */ new Date()).toISOString(),
    environment: process.env.NODE_ENV,
    sessionStore: redisAvailable ? "Redis" : "MemoryStore"
  });
});
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    sessionStore: redisAvailable ? "Redis" : "MemoryStore",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    uptime: process.uptime()
  });
});
app.get("/api/metrics", (req, res) => {
  res.json({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    sessionStore: redisAvailable ? "Redis" : "MemoryStore",
    environment: process.env.NODE_ENV,
    timestamp: Date.now()
  });
});
app.get("/api/debug/static", (req, res) => {
  const distPath = path2.join(process.cwd(), "dist", "public");
  let files = [];
  if (fs2.existsSync(distPath)) {
    files = fs2.readdirSync(distPath);
  }
  res.json({
    cwd: process.cwd(),
    distPath,
    exists: fs2.existsSync(distPath),
    files,
    nodeEnv: process.env.NODE_ENV
  });
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api/auth/reset-password", authLimiter);
if (!isProduction2) {
  app.get("/api/debug/session-state", (req, res) => {
    res.json({
      sessionID: req.sessionID,
      userId: req.session?.userId,
      role: req.session?.role,
      hasSession: !!req.session?.userId,
      environment: process.env.NODE_ENV,
      sessionStore: redisAvailable ? "Redis" : "MemoryStore"
    });
  });
  app.post("/api/debug/set-session", (req, res) => {
    req.session.userId = 1;
    req.session.role = "PASSENGER";
    req.session.save((err) => {
      if (err) {
        logger.error("Session save error:", err);
        return res.status(500).json({ error: err.message });
      }
      res.json({
        message: "Session set",
        sessionId: req.session.id,
        userId: req.session.userId
      });
    });
  });
  app.get("/api/debug/check-session", (req, res) => {
    res.json({
      sessionId: req.session.id,
      userId: req.session.userId,
      role: req.session.role,
      hasSession: !!req.session.userId
    });
  });
}
async function startServer() {
  try {
    const port = parseInt(process.env.PORT || "5000", 10);
    const host = "0.0.0.0";
    httpServer = createServer(app);
    await registerRoutes(httpServer, app);
    logger.info("\u2705 Routes registered");
    app.use((err, _req, res, _next) => {
      console.error("Error:", err);
      res.status(500).json({ message: "Erreur interne" });
    });
    const distPublicPath = path2.join(process.cwd(), "dist", "public");
    if (__require("fs").existsSync(distPublicPath)) {
      app.use(express2.static(distPublicPath));
      app.use((req, res, next) => {
        if (req.path.startsWith("/api")) return next();
        res.sendFile(path2.join(distPublicPath, "index.html"));
      });
    }
    httpServer.listen(port, host, () => {
      logger.info(`\u{1F680} Server running on port ${port}`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}
startServer();
