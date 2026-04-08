import { pgTable, text, serial, integer, boolean, timestamp, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Geo-restriction for Fort-Dauphin
//export const GEOCENTER = { lat: -25.0325, lng: 46.9920 };
//export const MAX_RADIUS_KM = 100;

// Nouvelles valeurs pour Anamalamanga
export const GEOCENTER = { lat: -18.8792, lng: 47.5079 };  // Centre d'Anamalamanga
export const MAX_RADIUS_KM = 50;  // Rayon de 50km autour d'Anamalamanga

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
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
  role: text("role").notNull().default("PASSENGER"),
  language: text("language").notNull().default("mg"),
  otpAuth: text("otp_auth"),
  isBlocked: boolean("is_blocked").notNull().default(false),
  idCardUrl: text("id_card_url"),
  isApproved: boolean("is_approved").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const driverProfiles = pgTable("driver_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  vehicleType: text("vehicle_type").notNull(),
  vehicleNumber: text("vehicle_number"),
  licenseNumber: text("license_number"),
  status: text("status").notNull().default("PENDING"),
  online: boolean("online").notNull().default(false),
  zone: text("zone"),
  ratingAvg: numeric("rating_avg", { precision: 3, scale: 2 }).default("0.00"),
  ratingCount: integer("rating_count").default(0),
});

export const driverDocuments = pgTable("driver_documents", {
  id: serial("id").primaryKey(),
  driverId: integer("driver_id").references(() => driverProfiles.id),
  type: text("type").notNull(),
  url: text("url").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

// Nouvelle table pour les documents passager
export const passengerDocuments = pgTable("passenger_documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  url: text("url").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const rides = pgTable("rides", {
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
  bookingId: integer("booking_id"),
});

export const offers = pgTable("offers", {
  id: serial("id").primaryKey(),
  rideId: integer("ride_id").notNull().references(() => rides.id),
  driverId: integer("driver_id").notNull().references(() => users.id),
  priceAr: integer("price_ar").notNull(),
  etaMinutes: integer("eta_minutes").notNull(),
  message: text("message"),
  status: text("status").notNull().default("SENT"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Nouvelle table pour les réservations
export const bookings = pgTable("bookings", {
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
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Nouvelle table pour les offres de réservation
export const bookingOffers = pgTable("booking_offers", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  driverId: integer("driver_id").notNull().references(() => users.id),
  priceAr: integer("price_ar").notNull(),
  etaMinutes: integer("eta_minutes").notNull(),
  message: text("message"),
  status: text("status").notNull().default("SENT"),
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

export const advertisements = pgTable("advertisements", {
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
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const adStats = pgTable("ad_stats", {
  id: serial("id").primaryKey(),
  adId: integer("ad_id").references(() => advertisements.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(),
  screen: text("screen"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  rideId: integer("ride_id").notNull().references(() => rides.id, { onDelete: "cascade" }),
  senderId: integer("sender_id").notNull().references(() => users.id),
  receiverId: integer("receiver_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Types TypeScript
export type Advertisement = typeof advertisements.$inferSelect;
export type InsertAdvertisement = typeof advertisements.$inferInsert;
export type AdStat = typeof adStats.$inferSelect;
export type InsertAdStat = typeof adStats.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;
export type PassengerDocument = typeof passengerDocuments.$inferSelect;
export type InsertPassengerDocument = typeof passengerDocuments.$inferInsert;
export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = typeof bookings.$inferInsert;
export type BookingOffer = typeof bookingOffers.$inferSelect;
export type InsertBookingOffer = typeof bookingOffers.$inferInsert;

// Zod schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertDriverProfileSchema = createInsertSchema(driverProfiles).omit({ id: true });
export const insertRideSchema = createInsertSchema(rides).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOfferSchema = createInsertSchema(offers).omit({ id: true, createdAt: true });
export const insertDriverLocationSchema = createInsertSchema(driverLocations).omit({ id: true, timestamp: true });
export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true });
export const insertPassengerDocumentSchema = createInsertSchema(passengerDocuments).omit({ id: true, uploadedAt: true });
export const insertBookingSchema = createInsertSchema(bookings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBookingOfferSchema = createInsertSchema(bookingOffers).omit({ id: true, createdAt: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type DriverProfile = typeof driverProfiles.$inferSelect;
export type DriverDocument = typeof driverDocuments.$inferSelect;
export type Ride = typeof rides.$inferSelect;
export type Offer = typeof offers.$inferSelect;
export type DriverLocation = typeof driverLocations.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type AppConfig = typeof appConfig.$inferSelect;
export type CustomPlace = typeof customPlaces.$inferSelect;

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

export type CreateBookingRequest = {
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  dropLat: number;
  dropLng: number;
  dropAddress: string;
  vehicleType: string;
  scheduledFor: Date | string;
  note?: string;
  distanceKm?: number;
  etaMinutes?: number;
  estimatedPriceAr?: number;
};

export type CancelRideRequest = { reason: string };
export type RateRideRequest = { rating: number; comment?: string };
export type UpdateOnlineStatusRequest = { online: boolean };
export type CreateOfferRequest = { rideId: number; priceAr: number; etaMinutes: number; message?: string };
export type UpdateRideStatusRequest = { status: string };
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
  CHAT_MESSAGE: 'CHAT_MESSAGE',
  BOOKING_NEW: 'booking:new',
  BOOKING_OFFER_NEW: 'booking_offer:new',
  BOOKING_OFFER_ACCEPTED: 'booking_offer:accepted',
  BOOKING_STATUS_CHANGED: 'booking:status_changed',
} as const;

export interface WsMessage<T = unknown> {
  type: keyof typeof WS_EVENTS;
  payload: T;
}