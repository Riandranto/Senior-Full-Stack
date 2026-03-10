import { z } from 'zod';
import { users, driverProfiles, rides, offers, appConfig, driverLocations, driverDocuments } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  })
};

const userSchema = z.custom<typeof users.$inferSelect>();
const driverProfileSchema = z.custom<typeof driverProfiles.$inferSelect>();
const rideSchema = z.custom<typeof rides.$inferSelect>();
const offerSchema = z.custom<typeof offers.$inferSelect>();
const configSchema = z.custom<typeof appConfig.$inferSelect>();
const documentSchema = z.custom<typeof driverDocuments.$inferSelect>();

export const api = {
  auth: {
    me: {
      method: 'GET' as const,
      path: '/api/auth/me' as const,
      responses: {
        200: userSchema,
        401: errorSchemas.unauthorized,
      }
    },
    requestOtp: {
      method: 'POST' as const,
      path: '/api/auth/request-otp' as const,
      input: z.object({ phone: z.string() }),
      responses: {
        200: z.object({ message: z.string() }),
        400: errorSchemas.validation,
      }
    },
    verifyOtp: {
      method: 'POST' as const,
      path: '/api/auth/verify-otp' as const,
      input: z.object({ phone: z.string(), otp: z.string() }),
      responses: {
        200: z.object({ user: userSchema }),
        401: errorSchemas.unauthorized,
      }
    },
    logout: {
      method: 'POST' as const,
      path: '/api/auth/logout' as const,
      responses: {
        200: z.object({ message: z.string() }),
      }
    }
  },
  passenger: {
    createRide: {
      method: 'POST' as const,
      path: '/api/rides' as const,
      input: z.object({
        pickupLat: z.number(),
        pickupLng: z.number(),
        pickupAddress: z.string(),
        dropLat: z.number(),
        dropLng: z.number(),
        dropAddress: z.string(),
        vehicleType: z.string(),
        note: z.string().optional(),
      }),
      responses: {
        201: rideSchema,
        400: errorSchemas.validation,
      }
    },
    getRide: {
      method: 'GET' as const,
      path: '/api/rides/:id' as const,
      responses: {
        200: rideSchema.and(z.object({ driver: userSchema.optional() })),
        404: errorSchemas.notFound,
      }
    },
    history: {
      method: 'GET' as const,
      path: '/api/rides' as const,
      responses: {
        200: z.array(rideSchema),
      }
    },
    cancelRide: {
      method: 'POST' as const,
      path: '/api/rides/:id/cancel' as const,
      input: z.object({ reason: z.string() }),
      responses: {
        200: rideSchema,
        400: errorSchemas.validation,
      }
    },
    rateRide: {
      method: 'POST' as const,
      path: '/api/rides/:id/rate' as const,
      input: z.object({ rating: z.number().min(1).max(5), comment: z.string().optional() }),
      responses: {
        200: z.object({ message: z.string() }),
      }
    },
    acceptOffer: {
      method: 'POST' as const,
      path: '/api/rides/:id/accept-offer' as const,
      input: z.object({ offerId: z.number() }),
      responses: {
        200: rideSchema,
        400: errorSchemas.validation,
      }
    },
    getOffers: {
      method: 'GET' as const,
      path: '/api/rides/:id/offers' as const,
      responses: {
        200: z.array(offerSchema.and(z.object({ driver: userSchema, profile: driverProfileSchema }))),
      }
    }
  },
  driver: {
    uploadDocument: {
      method: 'POST' as const,
      path: '/api/driver/documents' as const,
      // Input is FormData, returning document info
      responses: {
        201: documentSchema,
      }
    },
    getProfile: {
      method: 'GET' as const,
      path: '/api/driver/profile' as const,
      responses: {
        200: driverProfileSchema.and(z.object({ documents: z.array(documentSchema) })),
        404: errorSchemas.notFound,
      }
    },
    setOnline: {
      method: 'POST' as const,
      path: '/api/driver/online' as const,
      input: z.object({ online: z.boolean() }),
      responses: {
        200: driverProfileSchema,
      }
    },
    getRequests: {
      method: 'GET' as const,
      path: '/api/driver/requests' as const,
      responses: {
        200: z.array(rideSchema.and(z.object({ passenger: userSchema }))),
      }
    },
    sendOffer: {
      method: 'POST' as const,
      path: '/api/offers' as const,
      input: z.object({
        rideId: z.number(),
        priceAr: z.number(),
        etaMinutes: z.number(),
        message: z.string().optional(),
      }),
      responses: {
        201: offerSchema,
        400: errorSchemas.validation,
      }
    },
    updateRideStatus: {
      method: 'POST' as const,
      path: '/api/rides/:id/status' as const,
      input: z.object({ 
        status: z.enum([
          "DRIVER_EN_ROUTE",    // 🔥 AJOUTÉ
          "DRIVER_ARRIVED", 
          "IN_PROGRESS", 
          "COMPLETED"
        ]) 
      }),
      responses: {
        200: rideSchema,
        400: errorSchemas.validation,
      }
    },
    updateLocation: {
      method: 'POST' as const,
      path: '/api/driver/location' as const,
      input: z.object({ lat: z.number(), lng: z.number() }),
      responses: {
        200: z.object({ success: z.boolean() }),
      }
    }
  },
  admin: {
    getDrivers: {
      method: 'GET' as const,
      path: '/api/admin/drivers' as const,
      input: z.object({ status: z.string().optional() }).optional(),
      responses: {
        200: z.array(userSchema.and(z.object({ profile: driverProfileSchema, documents: z.array(documentSchema) }))),
      }
    },
    updateDriverStatus: {
      method: 'POST' as const,
      path: '/api/admin/drivers/:id/status' as const,
      input: z.object({ action: z.enum(["APPROVE", "REJECT", "SUSPEND"]), reason: z.string().optional() }),
      responses: {
        200: driverProfileSchema,
      }
    },
    getUsers: {
      method: 'GET' as const,
      path: '/api/admin/users' as const,
      responses: {
        200: z.array(userSchema),
      }
    },
    getRides: {
      method: 'GET' as const,
      path: '/api/admin/rides' as const,
      responses: {
        200: z.array(rideSchema),
      }
    },
    getConfig: {
      method: 'GET' as const,
      path: '/api/admin/config' as const,
      responses: {
        200: configSchema,
      }
    },
    updateConfig: {
      method: 'POST' as const,
      path: '/api/admin/config' as const,
      input: z.object({
        searchRadiusKm: z.number(),
        offerExpirySeconds: z.number(),
        commissionPercent: z.number(),
      }),
      responses: {
        200: configSchema,
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
