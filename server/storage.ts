import { db } from "./db";
import {
  users, driverProfiles, rides, offers, appConfig, driverLocations, driverDocuments, notifications, customPlaces,
  chatMessages, passengerDocuments, bookings, bookingOffers,
  type User, type DriverProfile, type Ride, type Offer, type AppConfig, type Notification, type CustomPlace,
  type InsertUser, type DriverLocation, type DriverDocument, type ChatMessage, type PassengerDocument, 
  type Booking, type BookingOffer
} from "@shared/schema";
import { eq, and, or, sql } from "drizzle-orm";
import { isWithinRange } from "@shared/schema";

export interface IStorage {
  // Auth & Users
  getUser(id: number): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserRole(id: number, role: string): Promise<User>;
  updateUser(id: number, update: Partial<User>): Promise<User>;

  // Drivers
  getDriverProfile(userId: number): Promise<DriverProfile | undefined>;
  getDriverProfileById(profileId: number): Promise<DriverProfile | undefined>;
  createDriverProfile(profile: any): Promise<DriverProfile>;
  updateDriverStatus(id: number, status: string): Promise<DriverProfile>;
  updateDriverOnline(userId: number, online: boolean): Promise<DriverProfile>;
  updateDriverOnlineByProfileId(profileId: number, online: boolean): Promise<DriverProfile>;
  getPendingDrivers(): Promise<DriverProfile[]>;
  getAllDrivers(): Promise<DriverProfile[]>;
  getAllUsers(): Promise<User[]>;
  
  // Rides
  createRide(ride: any): Promise<Ride>;
  getRide(id: number): Promise<Ride | undefined>;
  updateRideStatus(id: number, status: string): Promise<Ride>;
  cancelRide(id: number, reason: string, cancelBy: string): Promise<Ride>;
  acceptOffer(rideId: number, offerId: number, price: number, driverId: number): Promise<Ride>;
  getPassengerRides(passengerId: number): Promise<Ride[]>;
  getRideHistory(userId: number): Promise<Ride[]>;
  getNearbyRequests(lat?: number, lng?: number): Promise<Ride[]>;
  getAllRides(): Promise<Ride[]>;

  // Offers
  createOffer(offer: any): Promise<Offer>;
  getOffersForRide(rideId: number): Promise<Offer[]>;
  
  // Notifications
  createNotification(notif: { userId: number; title: string; message: string; type?: string; rideId?: number }): Promise<Notification>;
  getNotifications(userId: number): Promise<Notification[]>;
  getUnreadCount(userId: number): Promise<number>;
  markAsRead(id: number, userId: number): Promise<void>;
  markAllAsRead(userId: number): Promise<void>;

  // Ratings
  rateDriver(driverUserId: number, rating: number): Promise<void>;

  // Admin analytics
  getAdminStats(): Promise<{
    totalUsers: number;
    totalDrivers: number;
    totalRides: number;
    activeRides: number;
    completedRides: number;
    canceledRides: number;
    onlineDrivers: number;
    pendingDrivers: number;
    totalRevenue: number;
  }>;
  getRidesWithDetails(): Promise<any[]>;
  getDriversWithDetails(): Promise<any[]>;
  blockUser(id: number, blocked: boolean): Promise<User>;
  adminCancelRide(id: number, reason: string): Promise<Ride>;
  getDriverDocuments(driverId: number): Promise<DriverDocument[]>;
  createDriverDocument(doc: { driverId: number; type: string; url: string }): Promise<DriverDocument>;
  getAllOffers(): Promise<Offer[]>;

  // Passenger Documents
  getPassengerDocuments(userId: number): Promise<PassengerDocument[]>;
  createPassengerDocument(userId: number, type: string, url: string): Promise<PassengerDocument>;
  deletePassengerDocument(id: number, userId: number): Promise<void>;

  // Bookings
  createBooking(booking: any): Promise<Booking>;
  getBooking(id: number): Promise<Booking | undefined>;
  getPassengerBookings(userId: number): Promise<Booking[]>;
  getDriverBookings(driverId: number): Promise<Booking[]>;
  getAvailableBookings(): Promise<Booking[]>;
  getAllBookings(): Promise<Booking[]>;
  updateBookingStatus(id: number, status: string, driverId?: number): Promise<Booking>;
  cancelBooking(id: number, reason: string, cancelBy: string): Promise<Booking>;
  createBookingOffer(offer: any): Promise<BookingOffer>;
  getBookingOffers(bookingId: number): Promise<BookingOffer[]>;
  acceptBookingOffer(bookingId: number, offerId: number): Promise<Booking>;

  // Custom Places
  getCustomPlaces(): Promise<CustomPlace[]>;
  createCustomPlace(place: { name: string; nameFr: string; lat: string; lng: string }): Promise<CustomPlace>;
  updateCustomPlace(id: number, place: { name: string; nameFr: string; lat: string; lng: string }): Promise<CustomPlace>;
  deleteCustomPlace(id: number): Promise<void>;

  // App Config
  getConfig(): Promise<AppConfig>;
  updateConfig(config: any): Promise<AppConfig>;
  
  // Additional
  getDriverActiveRide(driverId: number): Promise<Ride | undefined>;
  updateRideEta(id: number, additionalMinutes: number): Promise<Ride>;

  // Nouveaux méthodes pour email
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByName(name: string): Promise<User | undefined>;
}

export class DatabaseStorage implements IStorage {
  // ==================== CONFIG ====================
  async getConfig(): Promise<AppConfig> {
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

  async updateConfig(config: any): Promise<AppConfig> {
    const existing = await this.getConfig();
    const [updated] = await db.update(appConfig)
      .set({
        searchRadiusKm: config.searchRadiusKm?.toString(),
        offerExpirySeconds: config.offerExpirySeconds,
        commissionPercent: config.commissionPercent?.toString()
      })
      .where(eq(appConfig.id, existing.id))
      .returning();
    return updated;
  }

  //=================== MAIL ====================
  async getUserByEmail(email: string): Promise<User | undefined> {
    if (!email) return undefined;
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }
  
  async getUserByName(name: string): Promise<User | undefined> {
    if (!name) return undefined;
    const [user] = await db.select().from(users).where(eq(users.name, name));
    return user;
  }
  

  // ==================== USERS ====================
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phone, phone));
    return user;
  }

  // Surcharger createUser pour supporter email
  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values({
      phone: insertUser.phone,
      email: insertUser.email || null,
      name: insertUser.name,
      role: insertUser.role || "PASSENGER",
      language: insertUser.language || "mg",
    }).returning();
    return user;
  }

  async updateUserRole(id: number, role: string): Promise<User> {
    const [user] = await db.update(users).set({ role }).where(eq(users.id, id)).returning();
    return user;
  }

  async updateUser(id: number, update: Partial<User>): Promise<User> {
    const [user] = await db.update(users).set(update).where(eq(users.id, id)).returning();
    return user;
  }

  // ==================== DRIVERS ====================
  async getDriverProfile(userId: number): Promise<DriverProfile | undefined> {
    const [profile] = await db.select().from(driverProfiles).where(eq(driverProfiles.userId, userId));
    return profile;
  }

  async getDriverProfileById(profileId: number): Promise<DriverProfile | undefined> {
    const [profile] = await db.select().from(driverProfiles).where(eq(driverProfiles.id, profileId));
    return profile;
  }

  async createDriverProfile(profile: any): Promise<DriverProfile> {
    const [newProfile] = await db.insert(driverProfiles).values({
      userId: profile.userId,
      vehicleType: profile.vehicleType,
      vehicleNumber: profile.vehicleNumber,
      licenseNumber: profile.licenseNumber,
      status: profile.status || "PENDING",
      online: profile.online || false,
    }).returning();
    return newProfile;
  }

  async updateDriverStatus(id: number, status: string): Promise<DriverProfile> {
    const [profile] = await db.update(driverProfiles).set({ status }).where(eq(driverProfiles.id, id)).returning();
    return profile;
  }

  async updateDriverOnline(userId: number, online: boolean): Promise<DriverProfile> {
    const [profile] = await db.update(driverProfiles).set({ online }).where(eq(driverProfiles.userId, userId)).returning();
    return profile;
  }

  async updateDriverOnlineByProfileId(profileId: number, online: boolean): Promise<DriverProfile> {
    const [profile] = await db.update(driverProfiles).set({ online }).where(eq(driverProfiles.id, profileId)).returning();
    return profile;
  }

  async getPendingDrivers(): Promise<DriverProfile[]> {
    return await db.select().from(driverProfiles).where(eq(driverProfiles.status, "PENDING"));
  }
  
  async getAllDrivers(): Promise<DriverProfile[]> {
    return await db.select().from(driverProfiles);
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  // ==================== RIDES ====================
  async createRide(ride: any): Promise<Ride> {
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
      etaMinutes: ride.etaMinutes,
    }).returning();
    return newRide;
  }

  async getRide(id: number): Promise<Ride | undefined> {
    const [ride] = await db.select().from(rides).where(eq(rides.id, id));
    return ride;
  }

  async updateRideStatus(id: number, status: string): Promise<Ride> {
    const [ride] = await db.update(rides).set({ status, updatedAt: new Date() }).where(eq(rides.id, id)).returning();
    return ride;
  }

  async cancelRide(id: number, reason: string, cancelBy: string): Promise<Ride> {
    const [ride] = await db.update(rides).set({ 
      status: "CANCELED", 
      cancelReason: reason, 
      cancelBy, 
      updatedAt: new Date() 
    }).where(eq(rides.id, id)).returning();
    
    const otherUserId = cancelBy === 'PASSENGER' ? ride.driverId : ride.passengerId;
    if (otherUserId) {
      await this.createNotification({
        userId: otherUserId,
        title: "Nofoanana ny dia",
        message: `Ny ${cancelBy === 'PASSENGER' ? 'mpandeha' : 'mpamily'} dia nanafoana ny dia. Antony: ${reason}`,
        type: "RIDE_CANCELED",
        rideId: id,
      });
    }
    
    if (cancelBy === 'DRIVER') {
      await db.update(rides).set({ driverId: null, status: "REQUESTED" }).where(eq(rides.id, id));
    }
    
    return ride;
  }

  async acceptOffer(rideId: number, offerId: number, price: number, driverId: number): Promise<Ride> {
    await db.update(offers).set({ status: "ACCEPTED" }).where(eq(offers.id, offerId));
    
    await db.update(offers).set({ status: "EXPIRED" }).where(and(
      eq(offers.rideId, rideId),
      sql`${offers.id} != ${offerId}`
    ));
    
    const [ride] = await db.update(rides).set({ 
      status: "ASSIGNED", 
      driverId, 
      selectedPriceAr: price, 
      updatedAt: new Date() 
    }).where(eq(rides.id, rideId)).returning();
    
    const passenger = await this.getUser(ride.passengerId);
    await this.createNotification({
      userId: driverId,
      title: "Tolobidy voaray!",
      message: `${passenger?.name || 'Mpandeha'} dia nanaiky ny tolobidy Ar ${price}`,
      type: "OFFER_ACCEPTED",
      rideId: rideId,
    });
    
    await this.createNotification({
      userId: ride.passengerId,
      title: "Tolobidy voaray!",
      message: `Ny mpamily ${(await this.getUser(driverId))?.name || 'Mpamily'} dia nanaiky ny tolobidy Ar ${price}`,
      type: "OFFER_ACCEPTED",
      rideId: rideId,
    });
    
    return ride;
  }

  async getPassengerRides(passengerId: number): Promise<Ride[]> {
    return await db.select().from(rides).where(eq(rides.passengerId, passengerId)).orderBy(sql`${rides.createdAt} DESC`);
  }

  async getRideHistory(userId: number): Promise<Ride[]> {
    try {
      const result = await db.select().from(rides)
        .where(sql`${rides.passengerId} = ${userId} OR ${rides.driverId} = ${userId}`)
        .orderBy(sql`${rides.createdAt} DESC`);
      return result;
    } catch (error) {
      console.error('Error in getRideHistory:', error);
      return [];
    }
  }

  async getNearbyRequests(lat?: number, lng?: number): Promise<Ride[]> {
    const allRequests = await db.select().from(rides).where(or(eq(rides.status, "REQUESTED"), eq(rides.status, "BIDDING"))).orderBy(sql`${rides.createdAt} DESC`);
    /*if (lat !== undefined && lng !== undefined) {
      return allRequests.filter(r => isWithinRange(Number(r.pickupLat), Number(r.pickupLng)));
    }*/
    return allRequests;
  }

  async getAllRides(): Promise<Ride[]> {
    return await db.select().from(rides).orderBy(sql`${rides.createdAt} DESC`);
  }

  // ==================== OFFERS ====================
  async createOffer(offer: any): Promise<Offer> {
    const [newOffer] = await db.insert(offers).values({
      rideId: offer.rideId,
      driverId: offer.driverId,
      priceAr: offer.priceAr,
      etaMinutes: offer.etaMinutes,
      message: offer.message,
      expiresAt: offer.expiresAt,
    }).returning();
    await db.update(rides).set({ status: "BIDDING" }).where(and(eq(rides.id, offer.rideId), eq(rides.status, "REQUESTED")));
    return newOffer;
  }

  async getOffersForRide(rideId: number): Promise<Offer[]> {
    return await db.select().from(offers).where(and(eq(offers.rideId, rideId), or(eq(offers.status, "SENT"), eq(offers.status, "ACCEPTED"))));
  }

  // ==================== NOTIFICATIONS ====================
  async createNotification(notif: { userId: number; title: string; message: string; type?: string; rideId?: number }): Promise<Notification> {
    const [n] = await db.insert(notifications).values({
      userId: notif.userId,
      title: notif.title,
      message: notif.message,
      type: notif.type || "INFO",
      rideId: notif.rideId,
    }).returning();
    return n;
  }

  async getNotifications(userId: number): Promise<Notification[]> {
    return await db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(sql`${notifications.createdAt} DESC`).limit(50);
  }

  async getUnreadCount(userId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return Number(result[0]?.count || 0);
  }

  async markAsRead(id: number, userId: number): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
  }

  async markAllAsRead(userId: number): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
  }

  // ==================== ADMIN STATS ====================
  async getAdminStats() {
    const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const [driverCount] = await db.select({ count: sql<number>`count(*)` }).from(driverProfiles);
    const [rideCount] = await db.select({ count: sql<number>`count(*)` }).from(rides);
    const [activeCount] = await db.select({ count: sql<number>`count(*)` }).from(rides).where(
      or(eq(rides.status, "REQUESTED"), eq(rides.status, "BIDDING"), eq(rides.status, "ASSIGNED"), eq(rides.status, "DRIVER_EN_ROUTE"), eq(rides.status, "DRIVER_ARRIVED"), eq(rides.status, "IN_PROGRESS"))
    );
    const [completedCount] = await db.select({ count: sql<number>`count(*)` }).from(rides).where(eq(rides.status, "COMPLETED"));
    const [canceledCount] = await db.select({ count: sql<number>`count(*)` }).from(rides).where(eq(rides.status, "CANCELED"));
    const [onlineCount] = await db.select({ count: sql<number>`count(*)` }).from(driverProfiles).where(eq(driverProfiles.online, true));
    const [pendingCount] = await db.select({ count: sql<number>`count(*)` }).from(driverProfiles).where(eq(driverProfiles.status, "PENDING"));
    const [revenueResult] = await db.select({ total: sql<number>`COALESCE(SUM(selected_price_ar), 0)` }).from(rides).where(eq(rides.status, "COMPLETED"));

    return {
      totalUsers: Number(userCount.count),
      totalDrivers: Number(driverCount.count),
      totalRides: Number(rideCount.count),
      activeRides: Number(activeCount.count),
      completedRides: Number(completedCount.count),
      canceledRides: Number(canceledCount.count),
      onlineDrivers: Number(onlineCount.count),
      pendingDrivers: Number(pendingCount.count),
      totalRevenue: Number(revenueResult.total),
    };
  }

  async getRidesWithDetails(): Promise<any[]> {
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

  async getDriversWithDetails(): Promise<any[]> {
    try {
      console.log('🔍 Fetching drivers with details...');
      
      const allProfiles = await db.select().from(driverProfiles);
      console.log(`📋 Found ${allProfiles.length} driver profiles`);
      
      const results = [];
      
      for (const p of allProfiles) {
        try {
          const user = await this.getUser(p.userId);
          if (!user) {
            console.warn(`⚠️ User not found for driver profile ${p.id} (userId: ${p.userId})`);
            continue;
          }
          
          const docs = await db.select().from(driverDocuments)
            .where(eq(driverDocuments.driverId, p.id));
          
          const driverRides = await db.select().from(rides)
            .where(eq(rides.driverId, p.userId));
          
          const completedRides = driverRides.filter(r => r.status === "COMPLETED");
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
          console.error(`❌ Error processing driver profile ${p.id}:`, err);
        }
      }
      
      console.log(`✅ Total drivers with details: ${results.length}`);
      return results;
    } catch (error) {
      console.error('❌ Error in getDriversWithDetails:', error);
      return [];
    }
  }

  async blockUser(id: number, blocked: boolean): Promise<User> {
    const [user] = await db.update(users).set({ isBlocked: blocked }).where(eq(users.id, id)).returning();
    return user;
  }

  async adminCancelRide(id: number, reason: string): Promise<Ride> {
    const [ride] = await db.update(rides).set({ 
      status: "CANCELED", 
      cancelReason: reason, 
      cancelBy: "ADMIN", 
      updatedAt: new Date() 
    }).where(eq(rides.id, id)).returning();
    return ride;
  }

  async getDriverDocuments(driverId: number): Promise<DriverDocument[]> {
    try {
      return await db.select().from(driverDocuments).where(eq(driverDocuments.driverId, driverId));
    } catch (error) {
      console.error('Error in getDriverDocuments:', error);
      return [];
    }
  }

  async createDriverDocument(doc: { driverId: number; type: string; url: string }): Promise<DriverDocument> {
    const [result] = await db.insert(driverDocuments).values({
      driverId: doc.driverId,
      type: doc.type,
      url: doc.url,
    }).returning();
    return result;
  }

  async getAllOffers(): Promise<Offer[]> {
    return await db.select().from(offers).orderBy(sql`${offers.createdAt} DESC`);
  }

  async rateDriver(driverUserId: number, rating: number): Promise<void> {
    const profile = await this.getDriverProfile(driverUserId);
    if (!profile) return;
    const newCount = (profile.ratingCount || 0) + 1;
    const currentAvg = parseFloat(profile.ratingAvg || "0");
    const newAvg = ((currentAvg * (newCount - 1)) + rating) / newCount;
    await db.update(driverProfiles).set({
      ratingAvg: newAvg.toFixed(2),
      ratingCount: newCount,
    }).where(eq(driverProfiles.userId, driverUserId));
  }

  // ==================== PASSENGER DOCUMENTS ====================
  async getPassengerDocuments(userId: number): Promise<PassengerDocument[]> {
    return await db.select().from(passengerDocuments)
      .where(eq(passengerDocuments.userId, userId))
      .orderBy(sql`${passengerDocuments.uploadedAt} DESC`);
  }

  async createPassengerDocument(userId: number, type: string, url: string): Promise<PassengerDocument> {
    const [doc] = await db.insert(passengerDocuments).values({
      userId,
      type,
      url,
    }).returning();
    return doc;
  }

  async deletePassengerDocument(id: number, userId: number): Promise<void> {
    await db.delete(passengerDocuments)
      .where(and(
        eq(passengerDocuments.id, id),
        eq(passengerDocuments.userId, userId)
      ));
  }

  // ==================== BOOKINGS ====================
  async createBooking(booking: any): Promise<Booking> {
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
      estimatedPriceAr: booking.estimatedPriceAr,
    }).returning();
    return newBooking;
  }

  async getBooking(id: number): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
    return booking;
  }

  async getPassengerBookings(userId: number): Promise<Booking[]> {
    return await db.select().from(bookings)
      .where(eq(bookings.passengerId, userId))
      .orderBy(sql`${bookings.scheduledFor} DESC`);
  }

  async getDriverBookings(driverId: number): Promise<Booking[]> {
    return await db.select().from(bookings)
      .where(eq(bookings.driverId, driverId))
      .orderBy(sql`${bookings.scheduledFor} ASC`);
  }

  async getAvailableBookings(): Promise<Booking[]> {
    return await db.select().from(bookings)
      .where(and(
        eq(bookings.status, 'PENDING'),
        sql`${bookings.scheduledFor} > NOW()`
      ))
      .orderBy(sql`${bookings.scheduledFor} ASC`);
  }

  async getAllBookings(): Promise<Booking[]> {
    return await db.select().from(bookings)
      .orderBy(sql`${bookings.scheduledFor} DESC`);
  }

  async updateBookingStatus(id: number, status: string, driverId?: number): Promise<Booking> {
    const updateData: any = { status, updatedAt: new Date() };
    if (driverId !== undefined) updateData.driverId = driverId;
    
    const [booking] = await db.update(bookings)
      .set(updateData)
      .where(eq(bookings.id, id))
      .returning();
    return booking;
  }

  async cancelBooking(id: number, reason: string, cancelBy: string): Promise<Booking> {
    const [booking] = await db.update(bookings)
      .set({
        status: 'CANCELED',
        cancelReason: reason,
        cancelBy,
        updatedAt: new Date()
      })
      .where(eq(bookings.id, id))
      .returning();
    return booking;
  }

  async createBookingOffer(offer: any): Promise<BookingOffer> {
    const [newOffer] = await db.insert(bookingOffers).values({
      bookingId: offer.bookingId,
      driverId: offer.driverId,
      priceAr: offer.priceAr,
      etaMinutes: offer.etaMinutes,
      message: offer.message,
      expiresAt: offer.expiresAt,
    }).returning();
    return newOffer;
  }

  async getBookingOffers(bookingId: number): Promise<BookingOffer[]> {
    return await db.select().from(bookingOffers)
      .where(eq(bookingOffers.bookingId, bookingId))
      .orderBy(sql`${bookingOffers.createdAt} DESC`);
  }

  async acceptBookingOffer(bookingId: number, offerId: number): Promise<Booking> {
    await db.update(bookingOffers)
      .set({ status: 'ACCEPTED' })
      .where(eq(bookingOffers.id, offerId));
    
    await db.update(bookingOffers)
      .set({ status: 'EXPIRED' })
      .where(and(
        eq(bookingOffers.bookingId, bookingId),
        sql`${bookingOffers.id} != ${offerId}`
      ));
    
    const [offer] = await db.select().from(bookingOffers).where(eq(bookingOffers.id, offerId));
    
    const [booking] = await db.update(bookings)
      .set({
        status: 'CONFIRMED',
        driverId: offer.driverId,
        finalPriceAr: offer.priceAr,
        updatedAt: new Date()
      })
      .where(eq(bookings.id, bookingId))
      .returning();
    
    return booking;
  }

  // ==================== CUSTOM PLACES ====================
  async getCustomPlaces(): Promise<CustomPlace[]> {
    return await db.select().from(customPlaces).orderBy(sql`${customPlaces.name} ASC`);
  }

  async createCustomPlace(place: { name: string; nameFr: string; lat: string; lng: string }): Promise<CustomPlace> {
    const [result] = await db.insert(customPlaces).values(place).returning();
    return result;
  }

  async updateCustomPlace(id: number, place: { name: string; nameFr: string; lat: string; lng: string }): Promise<CustomPlace> {
    const [result] = await db.update(customPlaces).set(place).where(eq(customPlaces.id, id)).returning();
    return result;
  }

  async deleteCustomPlace(id: number): Promise<void> {
    await db.delete(customPlaces).where(eq(customPlaces.id, id));
  }

  async createRideFromBooking(bookingId: number, driverId: number): Promise<Ride> {
    // Récupérer la réservation
    const booking = await this.getBooking(bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }
    
    // Créer la course
    const [ride] = await db.insert(rides).values({
      passengerId: booking.passengerId,
      driverId: driverId,
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
      note: booking.note,
    }).returning();
    
    return ride;
  }

  // ==================== ADDITIONAL ====================
  async getDriverActiveRide(driverId: number): Promise<Ride | undefined> {
    const [ride] = await db.select().from(rides)
      .where(and(
        eq(rides.driverId, driverId),
        or(
          eq(rides.status, "ASSIGNED"),
          eq(rides.status, "DRIVER_EN_ROUTE"),
          eq(rides.status, "DRIVER_ARRIVED"),
          eq(rides.status, "IN_PROGRESS")
        )
      ))
      .orderBy(sql`${rides.createdAt} DESC`)
      .limit(1);
    return ride;
  }

  async updateRideEta(id: number, additionalMinutes: number): Promise<Ride> {
    const ride = await this.getRide(id);
    if (!ride) throw new Error("Ride not found");
    const currentEta = ride.etaMinutes || 0;
    const newEta = currentEta + additionalMinutes;
    const [updated] = await db.update(rides).set({ etaMinutes: newEta, updatedAt: new Date() }).where(eq(rides.id, id)).returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();