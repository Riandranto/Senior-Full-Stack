// src/lib/api.ts
import { api } from '@shared/routes';

// CORRECTION : Détection améliorée de l'environnement
const isLocalDev = window.location.hostname === 'localhost' || 
                   window.location.hostname === '127.0.0.1' ||
                   window.location.hostname.includes('192.168.') ||
                   window.location.hostname.includes('172.') ||
                   window.location.hostname.includes('10.');

export const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (isLocalDev 
    ? 'http://localhost:5000'
    : window.location.origin);

console.log('🔧 API_BASE_URL:', API_BASE_URL);
console.log('🔧 MODE:', import.meta.env.MODE);
console.log('🔧 Hostname:', window.location.hostname);
console.log('🔧 isLocalDev:', isLocalDev);
console.log('🔧 import.meta.env.DEV:', import.meta.env.DEV);
console.log('🔧 import.meta.env.MODE:', import.meta.env.MODE);

export class ApiError extends Error {
  status: number;
  data?: any;
  
  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// Fonction fetch unifiée avec gestion d'erreurs améliorée
export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const url = endpoint.startsWith('http') 
    ? endpoint 
    : `${API_BASE_URL}${endpoint}`;
  
  console.log(`🌐 [apiFetch] ${endpoint} -> ${url}`);
  
  const defaultOptions: RequestInit = {
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      ...options.headers,
    },
  };
  
  // Ne pas ajouter Content-Type pour FormData
  if (!(options.body instanceof FormData)) {
    defaultOptions.headers = {
      ...defaultOptions.headers,
      'Content-Type': 'application/json',
    };
  }
  
  try {
    const response = await fetch(url, {
      ...defaultOptions,
      ...options,
    });
    
    console.log(`📡 [apiFetch] Response status: ${response.status} for ${endpoint}`);
    
    // Gérer les erreurs HTTP
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: response.statusText };
      }
      
      const errorMessage = errorData.message || `Erreur ${response.status}`;
      throw new ApiError(errorMessage, response.status, errorData);
    }
    
    return response;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Erreur réseau
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new ApiError(
        'Impossible de se connecter au serveur. Vérifiez votre connexion.',
        0,
        { networkError: true }
      );
    }
    
    throw new ApiError(
      error instanceof Error ? error.message : 'Erreur inconnue',
      500
    );
  }
}

// Helper pour les requêtes GET
export async function apiGet<T>(endpoint: string): Promise<T> {
  const response = await apiFetch(endpoint);
  return response.json();
}

// Helper pour les requêtes POST
export async function apiPost<T>(endpoint: string, data?: any): Promise<T> {
  const response = await apiFetch(endpoint, {
    method: 'POST',
    body: data instanceof FormData ? data : JSON.stringify(data),
  });
  return response.json();
}

// Helper pour les requêtes PUT
export async function apiPut<T>(endpoint: string, data?: any): Promise<T> {
  const response = await apiFetch(endpoint, {
    method: 'PUT',
    body: data instanceof FormData ? data : JSON.stringify(data),
  });
  return response.json();
}

// Helper pour les requêtes PATCH
export async function apiPatch<T>(endpoint: string, data?: any): Promise<T> {
  const response = await apiFetch(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return response.json();
}

// Helper pour les requêtes DELETE
export async function apiDelete<T>(endpoint: string): Promise<T> {
  const response = await apiFetch(endpoint, {
    method: 'DELETE',
  });
  return response.json();
}

// ==================== AUTH ROUTES ====================

export async function requestOtp(phone: string) {
  return apiPost(api.auth.requestOtp.path, { phone });
}

export async function verifyOtp(phone: string, otp: string) {
  return apiPost('/api/auth/verify-otp', { phone, otp });
}

export async function getCurrentUser() {
  return apiGet(api.auth.me.path);
}

export async function logout() {
  return apiPost(api.auth.logout.path);
}

// ==================== PASSENGER ROUTES ====================

export async function createRide(rideData: any) {
  return apiPost(api.passenger.createRide.path, rideData);
}

export async function getRide(id: number) {
  return apiGet(api.passenger.getRide.path.replace(':id', id.toString()));
}

export async function getRideHistory() {
  return apiGet(api.passenger.history.path);
}

export async function cancelRide(id: number, reason: string) {
  return apiPost(api.passenger.cancelRide.path.replace(':id', id.toString()), { reason });
}

export async function getOffersForRide(rideId: number) {
  return apiGet(api.passenger.getOffers.path.replace(':id', rideId.toString()));
}

export async function acceptOffer(rideId: number, offerId: number) {
  return apiPost(api.passenger.acceptOffer.path.replace(':id', rideId.toString()), { offerId });
}

export async function rateRide(rideId: number, rating: number, review?: string) {
  return apiPost(api.passenger.rateRide.path.replace(':id', rideId.toString()), { rating, review });
}

// ==================== DRIVER ROUTES ====================

export async function setDriverOnline(online: boolean) {
  return apiPost(api.driver.setOnline.path, { online });
}

export async function getDriverProfile() {
  return apiGet(api.driver.getProfile.path);
}

export async function getDriverRequests() {
  return apiGet(api.driver.getRequests.path);
}

export async function sendOffer(rideId: number, priceAr: number, etaMinutes: number, message?: string) {
  return apiPost(api.driver.sendOffer.path, { rideId, priceAr, etaMinutes, message });
}

export async function updateRideStatus(rideId: number, status: string) {
  return apiPost(api.driver.updateRideStatus.path.replace(':id', rideId.toString()), { status });
}

export async function updateDriverLocation(lat: number, lng: number) {
  return apiPost(api.driver.updateLocation.path, { lat, lng });
}

export async function uploadDriverDocument(file: File, type: string, vehicleType?: string, vehicleNumber?: string, licenseNumber?: string) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);
  if (vehicleType) formData.append('vehicleType', vehicleType);
  if (vehicleNumber) formData.append('vehicleNumber', vehicleNumber);
  if (licenseNumber) formData.append('licenseNumber', licenseNumber);
  
  return apiPost(api.driver.uploadDocument.path, formData);
}

export async function getDriverActiveRide() {
  return apiGet('/api/driver/active-ride');
}

export async function getDriverDocuments() {
  return apiGet('/api/driver/documents');
}

export async function registerDriver(vehicleType: string, vehicleNumber: string, licenseNumber: string) {
  return apiPost('/api/driver/register', { vehicleType, vehicleNumber, licenseNumber });
}

// ==================== RIDE ROUTES ====================

export async function getActiveRide() {
  return apiGet('/api/rides/active');
}

export async function updateRideEta(rideId: number, additionalMinutes: number) {
  return apiPost(`/api/rides/${rideId}/eta`, { additionalMinutes });
}

export async function getRideViews(rideId: number) {
  return apiGet(`/api/rides/${rideId}/views`);
}

// ==================== CHAT ROUTES ====================

export async function getChatHistory(rideId: number) {
  return apiGet(`/api/chat/history/${rideId}`);
}

export async function sendChatMessage(rideId: number, message: string, toUserId?: number) {
  return apiPost('/api/chat/send', { rideId, message, toUserId });
}

export async function markMessagesAsRead(rideId: number) {
  return apiPost(`/api/chat/mark-read/${rideId}`);
}

// ==================== NOTIFICATION ROUTES ====================

export async function getNotifications() {
  return apiGet('/api/notifications');
}

export async function getUnreadNotificationCount() {
  return apiGet('/api/notifications/unread-count');
}

export async function markNotificationAsRead(id: number) {
  return apiPost(`/api/notifications/${id}/read`);
}

export async function markAllNotificationsAsRead() {
  return apiPost('/api/notifications/read-all');
}

// ==================== ADVERTISEMENT ROUTES ====================

export async function getAds(screen?: string, userRole?: string) {
  let url = '/api/ads';
  const params = new URLSearchParams();
  if (screen) params.append('screen', screen);
  if (userRole) params.append('userRole', userRole);
  if (params.toString()) url += `?${params.toString()}`;
  return apiGet(url);
}

export async function recordAdClick(adId: number, screen?: string) {
  return apiPost(`/api/ads/${adId}/click`, { screen });
}

// Admin ad routes
export async function getAllAds() {
  return apiGet('/api/admin/ads');
}

export async function createAd(formData: FormData) {
  return apiPost('/api/admin/ads', formData);
}

export async function updateAd(id: number, formData: FormData) {
  return apiPut(`/api/admin/ads/${id}`, formData);
}

export async function deleteAd(id: number) {
  return apiDelete(`/api/admin/ads/${id}`);
}

export async function getAdStats(id: number) {
  return apiGet(`/api/admin/ads/${id}/stats`);
}

// ==================== ADMIN ROUTES ====================

export async function getAdminStats() {
  return apiGet('/api/admin/stats');
}

export async function getAdminDrivers() {
  return apiGet(api.admin.getDrivers.path);
}

export async function updateDriverStatus(profileId: number, action: 'APPROVE' | 'REJECT' | 'SUSPEND') {
  return apiPost(api.admin.updateDriverStatus.path.replace(':id', profileId.toString()), { action });
}

export async function getAdminUsers() {
  return apiGet(api.admin.getUsers.path);
}

export async function getAdminRides() {
  return apiGet(api.admin.getRides.path);
}

export async function blockUser(userId: number, blocked: boolean) {
  return apiPost(`/api/admin/users/${userId}/block`, { blocked });
}

export async function adminCancelRide(rideId: number, reason: string) {
  return apiPost(`/api/admin/rides/${rideId}/cancel`, { reason });
}

export async function getDriverLocations() {
  return apiGet('/api/admin/driver-locations');
}

export async function getAdminConfig() {
  return apiGet(api.admin.getConfig.path);
}

export async function updateAdminConfig(config: any) {
  return apiPost(api.admin.updateConfig.path, config);
}

export async function getAllBookings() {
  return apiGet('/api/admin/bookings');
}

export async function adminCancelBooking(bookingId: number, reason: string) {
  return apiPost(`/api/admin/bookings/${bookingId}/cancel`, { reason });
}

// ==================== BOOKINGS ROUTES ====================

export async function createBooking(bookingData: any) {
  return apiPost('/api/bookings', bookingData);
}

export async function getMyBookings() {
  return apiGet('/api/bookings');
}

export async function getBooking(id: number) {
  return apiGet(`/api/bookings/${id}`);
}

export async function createBookingOffer(bookingId: number, priceAr: number, etaMinutes: number, message?: string) {
  return apiPost(`/api/bookings/${bookingId}/offers`, { priceAr, etaMinutes, message });
}

export async function acceptBookingOffer(bookingId: number, offerId: number) {
  return apiPost(`/api/bookings/${bookingId}/accept-offer`, { offerId });
}

export async function cancelBooking(bookingId: number, reason?: string) {
  return apiPost(`/api/bookings/${bookingId}/cancel`, { reason });
}

export async function startRideFromBooking(bookingId: number) {
  return apiPost(`/api/bookings/${bookingId}/start-ride`);
}

export async function getAvailableDriverBookings() {
  return apiGet('/api/driver/bookings');
}

export async function getMyDriverBookings() {
  return apiGet('/api/driver/bookings/my');
}

export async function getUpcomingDriverBookings() {
  return apiGet('/api/driver/bookings/upcoming');
}

// ==================== PLACES ROUTES ====================

export async function getPlaces() {
  return apiGet('/api/places');
}

export async function getAdminPlaces() {
  return apiGet('/api/admin/places');
}

export async function createPlace(name: string, nameFr: string, lat: number, lng: number) {
  return apiPost('/api/admin/places', { name, nameFr, lat, lng });
}

export async function updatePlace(id: number, name: string, nameFr: string, lat: number, lng: number) {
  return apiPut(`/api/admin/places/${id}`, { name, nameFr, lat, lng });
}

export async function deletePlace(id: number) {
  return apiDelete(`/api/admin/places/${id}`);
}

// ==================== USER ROUTES ====================

export async function updateUserProfile(name: string) {
  return apiPost('/api/user/update', { name });
}

// ==================== PASSENGER DOCUMENTS ROUTES ====================

export async function getPassengerDocuments() {
  return apiGet('/api/passenger/documents');
}

export async function uploadPassengerDocument(file: File, type: string) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);
  return apiPost('/api/passenger/documents', formData);
}

export async function deletePassengerDocument(id: number) {
  return apiDelete(`/api/passenger/documents/${id}`);
}

// ==================== DEBUG ROUTES ====================

export async function debugSession() {
  return apiGet('/api/debug/session');
}

export async function debugSessionState() {
  return apiGet('/api/debug/session-state');
}

export async function debugEnv() {
  return apiGet('/api/debug/env');
}

export async function debugDb() {
  return apiGet('/api/debug/db');
}

export async function debugPaths() {
  return apiGet('/api/debug/paths');
}

export async function debugStatic() {
  return apiGet('/api/debug/static');
}

export async function healthCheck() {
  return apiGet('/api/health');
}

export async function getMetrics() {
  return apiGet('/api/metrics');
}

export async function testApi() {
  return apiGet('/api/test');
}

// ==================== LOCATION ROUTES ====================

export async function getDriverLocation(driverId: number) {
  return apiGet(`/api/driver/${driverId}/location`);
}

// ==================== WEBSOCKET ====================

export function createWebSocketConnection(): WebSocket {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsHost = isLocalDev ? 'localhost:5000' : window.location.host;
  const wsUrl = `${wsProtocol}//${wsHost}/ws`;
  
  console.log('🔌 Creating WebSocket connection to:', wsUrl);
  return new WebSocket(wsUrl);
}