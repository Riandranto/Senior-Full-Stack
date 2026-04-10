// src/lib/offline-api.ts
import { capacitorStorage, OfflineQueueItem } from './capacitor-storage';
import { offlineSync } from './offline-sync';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

// Routes qui peuvent être traitées en offline
const OFFLINE_CAPABLE_ROUTES = [
  '/api/bookings',
  '/api/rides/active',
  '/api/driver/active-ride',
  '/api/driver/requests',
  '/api/notifications',
];

// Routes qui nécessitent une connexion
const ONLINE_REQUIRED_ROUTES = [
  '/api/auth/login',
  '/api/auth/verify-otp',
  '/api/auth/request-otp',
  '/api/driver/register',
  '/api/driver/upload-document',
];

async function isOnline(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && 'connection' in navigator) {
    return navigator.onLine;
  }
  return true;
}

export async function offlineCapableFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const method = (options.method || 'GET') as HttpMethod;
  const isOfflineCapable = OFFLINE_CAPABLE_ROUTES.some(route => url.includes(route));
  const requiresOnline = ONLINE_REQUIRED_ROUTES.some(route => url.includes(route));
  
  const connected = await isOnline();

  // Si c'est une requête GET et offline-capable, essayer le cache d'abord
  if (method === 'GET' && isOfflineCapable && !connected) {
    const cachedData = await getCachedData(url);
    if (cachedData) {
      console.log(`📦 Serving ${url} from cache (offline mode)`);
      return new Response(JSON.stringify(cachedData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // Si pas de connexion et requête non-offline-capable
  if (!connected && (!isOfflineCapable || requiresOnline)) {
    return new Response(
      JSON.stringify({ message: 'No internet connection. Please try again later.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Tentative de requête en ligne
  try {
    const response = await fetch(url, options);
    
    // Mettre en cache les réponses GET réussies
    if (response.ok && method === 'GET' && isOfflineCapable) {
      const data = await response.clone().json();
      await cacheData(url, data);
    }
    
    return response;
  } catch (error) {
    // Si la requête échoue et qu'on est en offline, utiliser le cache
    if (!connected && isOfflineCapable) {
      const cachedData = await getCachedData(url);
      if (cachedData) {
        console.log(`📦 Serving ${url} from cache (request failed)`);
        return new Response(JSON.stringify(cachedData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    throw error;
  }
}

async function getCachedData(url: string): Promise<any | null> {
  const normalizedUrl = normalizeUrl(url);
  
  if (normalizedUrl.includes('/api/bookings')) {
    return await capacitorStorage.getBookings();
  }
  if (normalizedUrl.includes('/api/rides/active') || normalizedUrl.includes('/api/driver/active-ride')) {
    const rides = await capacitorStorage.getRides();
    return rides.length > 0 ? rides[0] : null;
  }
  if (normalizedUrl.includes('/api/notifications')) {
    const notifications = await capacitorStorage.getNotifications();
    return notifications;
  }
  if (normalizedUrl.includes('/api/auth/me')) {
    return await capacitorStorage.getUser();
  }
  
  return null;
}

async function cacheData(url: string, data: any): Promise<void> {
  const normalizedUrl = normalizeUrl(url);
  
  if (normalizedUrl.includes('/api/bookings')) {
    if (Array.isArray(data)) {
      await capacitorStorage.setBookings(data);
    } else if (data.id) {
      const existing = await capacitorStorage.getBookings();
      const updated = [data, ...existing.filter(b => b.id !== data.id)];
      await capacitorStorage.setBookings(updated);
    }
  }
  if (normalizedUrl.includes('/api/rides/active') || normalizedUrl.includes('/api/driver/active-ride')) {
    if (data) {
      await capacitorStorage.setRides([data]);
    }
  }
  if (normalizedUrl.includes('/api/auth/me')) {
    if (data && data.id) {
      await capacitorStorage.setUser(data);
    }
  }
}

function normalizeUrl(url: string): string {
  const urlObj = new URL(url, window.location.origin);
  return urlObj.pathname;
}

// Fonction pour exécuter une requête avec queue offline
export async function offlineQueueFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const method = (options.method || 'GET') as HttpMethod;
  const connected = await isOnline();

  // Pour les requêtes non-GET, les mettre en queue si offline
  if (method !== 'GET' && !connected) {
    let body = null;
    try {
      body = options.body ? JSON.parse(options.body as string) : null;
    } catch {
      body = options.body;
    }

    await capacitorStorage.addToOfflineQueue({
      url,
      method,
      body,
    });

    console.log(`📦 Queued ${method} ${url} for later sync`);
    
    return new Response(
      JSON.stringify({ 
        message: 'Request queued for offline sync',
        queued: true 
      }),
      { status: 202, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return offlineCapableFetch(url, options);
}