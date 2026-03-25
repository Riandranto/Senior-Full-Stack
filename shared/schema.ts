import { pgTable, text, serial, integer, boolean, timestamp, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Geo-restriction for Fort-Dauphin
export const GEOCENTER = { lat: -25.0325, lng: 46.9920 };
export const MAX_RADIUS_KM = 100;

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export function isWithinRange(lat: number, lng: number): boolean {
  return calculateDistance(lat, lng, GEOCENTER.lat, GEOCENTER.lng) <= MAX_RADIUS_KM;
}

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull().default("PASSENGER"), // PASSENGER, DRIVER, ADMIN
  language: text("language").notNull().default("mg"), // mg, fr
  otpAuth: text("otp_auth"),
  isBlocked: boolean("is_blocked").notNull().default(false),
  idCardUrl: text("id_card_url"), // CIN or School ID
  isApproved: boolean("is_approved").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const driverProfiles = pgTable("driver_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  vehicleType: text("vehicle_type").notNull(), // TAXI, BAJAJ
  vehicleNumber: text("vehicle_number"), // License plate / Matriculation
  licenseNumber: text("license_number"), // Driving license info
  status: text("status").notNull().default("PENDING"), // PENDING, APPROVED, REJECTED, SUSPENDED
  online: boolean("online").notNull().default(false),
  zone: text("zone"),
  ratingAvg: numeric("rating_avg", { precision: 3, scale: 2 }).default("0.00"),
  ratingCount: integer("rating_count").default(0),
});

export const driverDocuments = pgTable("driver_documents", {
  id: serial("id").primaryKey(),
  driverId: integer("driver_id").notNull().references(() => driverProfiles.id),
  type: text("type").notNull(), // CIN, PERMIS, VEHICLE, PHOTO
  url: text("url").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const rides = pgTable("rides", {
  id: serial("id").primaryKey(),
  passengerId: integer("passenger_id").notNull().references(() => users.id),
  driverId: integer("driver_id").references(() => users.id), // Actually references users.id (the driver user)
  status: text("status").notNull().default("REQUESTED"), // REQUESTED, BIDDING, ASSIGNED, DRIVER_EN_ROUTE, DRIVER_ARRIVED, IN_PROGRESS, COMPLETED, CANCELED
  pickupLat: numeric("pickup_lat", { precision: 10, scale: 7 }).notNull(),
  pickupLng: numeric("pickup_lng", { precision: 10, scale: 7 }).notNull(),
  pickupAddress: text("pickup_address").notNull(),
  dropLat: numeric("drop_lat", { precision: 10, scale: 7 }).notNull(),
  dropLng: numeric("drop_lng", { precision: 10, scale: 7 }).notNull(),
  dropAddress: text("drop_address").notNull(),
  distanceKm: numeric("distance_km", { precision: 6, scale: 2 }),
  etaMinutes: integer("eta_minutes"),
  selectedPriceAr: integer("selected_price_ar"),
  cancelBy: text("cancel_by"), // PASSENGER, DRIVER, ADMIN
  cancelReason: text("cancel_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  vehicleType: text("vehicle_type").notNull().default("TAXI"), // Requested vehicle type
  note: text("note"),
});

export const offers = pgTable("offers", {
  id: serial("id").primaryKey(),
  rideId: integer("ride_id").notNull().references(() => rides.id),
  driverId: integer("driver_id").notNull().references(() => users.id),
  priceAr: integer("price_ar").notNull(),
  etaMinutes: integer("eta_minutes").notNull(),
  message: text("message"),
  status: text("status").notNull().default("SENT"), // SENT, ACCEPTED, REJECTED, EXPIRED
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const driverLocations = pgTable("driver_locations", {
  id: serial("id").primaryKey(),
  driverId: integer("driver_id").notNull().references(() => users.id),
  lat: numeric("lat", { precision: 10, scale: 7 }).notNull(),
  lng: numeric("lng", { precision: 10, scale: 7 }).notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull().default("INFO"),
  isRead: boolean("is_read").notNull().default(false),
  rideId: integer("ride_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const customPlaces = pgTable("custom_places", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameFr: text("name_fr").notNull(),
  lat: numeric("lat", { precision: 10, scale: 7 }).notNull(),
  lng: numeric("lng", { precision: 10, scale: 7 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const appConfig = pgTable("app_config", {
  id: serial("id").primaryKey(),
  searchRadiusKm: numeric("search_radius_km", { precision: 5, scale: 2 }).notNull().default("5.0"),
  offerExpirySeconds: integer("offer_expiry_seconds").notNull().default(90),
  commissionPercent: numeric("commission_percent", { precision: 5, scale: 2 }).notNull().default("0.0"),
});

// Table pour les publicités
export const advertisements = pgTable("advertisements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  titleFr: text("title_fr").notNull(),
  description: text("description"),
  descriptionFr: text("description_fr"),
  imageUrl: text("image_url").notNull(),
  linkUrl: text("link_url"),
  type: text("type").notNull().default("BANNER"), // BANNER, FULLSCREEN, SPLASH
  position: text("position").default("HOME_TOP"), // HOME_TOP, HOME_BOTTOM, RIDE_SCREEN, PROFILE
  priority: integer("priority").default(0), // Plus haut = affiché en premier
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").default(true),
  impressionCount: integer("impression_count").default(0),
  clickCount: integer("click_count").default(0),
  targetAudience: text("target_audience"), // ALL, PASSENGER, DRIVER
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Table pour les statistiques d'affichage
export const adStats = pgTable("ad_stats", {
  id: serial("id").primaryKey(),
  adId: integer("ad_id").references(() => advertisements.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(), // IMPRESSION, CLICK
  screen: text("screen"), // HOME, RIDE, PROFILE
  createdAt: timestamp("created_at").defaultNow(),
});

// Types TypeScript
export type Advertisement = typeof advertisements.$inferSelect;
export type InsertAdvertisement = typeof advertisements.$inferInsert;
export type AdStat = typeof adStats.$inferSelect;
export type InsertAdStat = typeof adStats.$inferInsert;

// Zod schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertDriverProfileSchema = createInsertSchema(driverProfiles).omit({ id: true });
export const insertRideSchema = createInsertSchema(rides).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOfferSchema = createInsertSchema(offers).omit({ id: true, createdAt: true });
export const insertDriverLocationSchema = createInsertSchema(driverLocations).omit({ id: true, timestamp: true });

export type InsertUser = z.infer<typeof insertUserSchema>;

// Explicit API Contract Types
export type User = typeof users.$inferSelect;
export type DriverProfile = typeof driverProfiles.$inferSelect;
export type DriverDocument = typeof driverDocuments.$inferSelect;
export type Ride = typeof rides.$inferSelect;
export type Offer = typeof offers.$inferSelect;
export type DriverLocation = typeof driverLocations.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type AppConfig = typeof appConfig.$inferSelect;
export type CustomPlace = typeof customPlaces.$inferSelect;

// App config needs to always exist at id 1
export type ConfigResponse = AppConfig;

export type RequestOtpRequest = { phone: string };
export type VerifyOtpRequest = { phone: string; otp: string };

export type CreateRideRequest = {
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  dropLat: number;
  dropLng: number;
  dropAddress: string;
  vehicleType: string;
  note?: string;
  distanceKm?: number;
  etaMinutes?: number;
};

export type CancelRideRequest = { reason: string };
export type RateRideRequest = { rating: number; comment?: string };

export type UpdateOnlineStatusRequest = { online: boolean };

export type CreateOfferRequest = {
  rideId: number;
  priceAr: number;
  etaMinutes: number;
  message?: string;
};

export type UpdateRideStatusRequest = { status: string }; // DRIVER_ARRIVED, IN_PROGRESS, COMPLETED

export type UpdateLocationRequest = { lat: number; lng: number };

export type AdminApproveDriverRequest = { action: "APPROVE" | "REJECT" | "SUSPEND", reason?: string };

export type AcceptOfferRequest = { offerId: number };

export const WS_EVENTS = {
  RIDE_NEW_REQUEST: 'ride:new_request',
  OFFER_NEW: 'offer:new',
  OFFER_EXPIRED: 'offer:expired',
  OFFER_ACCEPTED: 'offer:accepted',
  RIDE_STATUS_CHANGED: 'ride:status_changed',
  DRIVER_LOCATION: 'driver:location',
} as const;

export interface WsMessage<T = unknown> {
  type: keyof typeof WS_EVENTS;
  payload: T;
}
