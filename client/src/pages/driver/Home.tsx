// src/pages/driver/Home.tsx - Version stable (pas de rafraîchissement infini)
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MobileLayout } from '@/components/RoleLayout';
import { MapView, LatLng, fetchOSRMRoute } from '@/components/Map';
import {
  useDriverProfile,
  useSetOnline,
  useDriverRequests,
  useSendOffer,
  useUpdateLocation,
  useDriverActiveRide,
  useUpdateRideStatus,
  useExtendEta
} from '@/hooks/use-driver';
import { useAutoRefresh } from '@/hooks/use-auto-refresh';
import { RefreshIndicator } from '@/components/RefreshIndicator';
import { LoadingAnimation } from '@/components/LoadingAnimation';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  MapPin, Navigation, Clock, Send, CheckCircle, Route, Phone,
  Loader2, AlertCircle, User, Bike, Car, Wifi, WifiOff,
  Play, XCircle, MessageCircle, Calendar, Truck,
  LocateFixed, Gauge, Crosshair, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useWebSocket } from '@/hooks/use-websocket';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ChatBox from '@/components/ChatBox';
import { GEOCENTER } from '@shared/schema';
import { apiFetch } from '@/lib/api';
import { AdBanner } from '@/components/AdBanner';
import { FullscreenAd } from '@/components/FullscreenAd';

const VEHICLE_TYPES = [
  { id: 'TAXI', label: 'Taxi', labelMg: 'Taxi', icon: Car, color: 'from-blue-500 to-blue-600' },
  { id: 'BAJAJ', label: 'Bajaj', labelMg: 'Bajaj', icon: Bike, color: 'from-green-500 to-green-600' },
  { id: 'CAMION', label: 'Camion', labelMg: 'Kamiao', icon: Truck, color: 'from-orange-500 to-orange-600' },
  { id: '4X4', label: '4x4 Location', labelMg: '4x4 Location', icon: Gauge, color: 'from-red-500 to-red-600' },
];

interface ActiveRide {
  id: number;
  passengerId: number;
  passengerName: string;
  passengerPhone: string;
  pickupAddress: string;
  dropAddress: string;
  status: string;
  etaMinutes: number;
  distanceKm: number;
  createdAt: string;
  pickupLat?: string | number;
  pickupLng?: string | number;
  dropLat?: string | number;
  dropLng?: string | number;
  vehicleType?: string;
  [key: string]: any;
}

const extractPrice = (ride: any): number => {
  if (!ride) return 0;
  const possibleFields = ['selectedPriceAr', 'price', 'priceAr', 'price_ar', 'amount', 'total', 'fare', 'cost', 'value', 'offerPrice', 'driverPrice'];
  for (const key of possibleFields) {
    const val = ride[key];
    if (val !== undefined && val !== null) {
      const num = Number(val);
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return 0;
};

export default function DriverHome() {
  const { t, lang } = useTranslation();
  const [, setLocation] = useLocation();
  const { data: profile, isLoading: profileLoading } = useDriverProfile();
  const setOnline = useSetOnline();
  const { data: requests = [], isLoading: requestsLoading, refetch: refetchRequests } = useDriverRequests();
  const sendOffer = useSendOffer();
  const updateLocation = useUpdateLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: activeRide, refetch: refetchActiveRide } = useDriverActiveRide();
  const { connected, sendMessage, subscribe } = useWebSocket();
  const updateRideStatus = useUpdateRideStatus(activeRide?.id || 0);
  const extendEta = useExtendEta(activeRide?.id || 0);
  const { refresh, isRefreshing } = useAutoRefresh({
    queryKeys: [['/api/driver/requests']],
    interval: 15000,
    enabled: false,
  });

  // États
  const [driverPos, setDriverPos] = useState<LatLng | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [gpsDenied, setGpsDenied] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMinimized, setChatMinimized] = useState(false);
  const [otherUserName, setOtherUserName] = useState('');
  const [otherUserId, setOtherUserId] = useState(0);
  const [otherUserPhone, setOtherUserPhone] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [price, setPrice] = useState('');
  const [priceError, setPriceError] = useState<string | null>(null);
  const [autoEta, setAutoEta] = useState<number | null>(null);
  const [calculatingEta, setCalculatingEta] = useState(false);
  const [offerSentFor, setOfferSentFor] = useState<Set<number>>(new Set());
  const [showRideTracking, setShowRideTracking] = useState(false);
  const [showCompletionConfirm, setShowCompletionConfirm] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [routeCoords, setRouteCoords] = useState<[number, number][] | undefined>(undefined);
  const [pickupCoords, setPickupCoords] = useState<LatLng | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<LatLng | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showBookings, setShowBookings] = useState(false);
  const [availableBookings, setAvailableBookings] = useState<any[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [bookingPrice, setBookingPrice] = useState('');
  const [bookingPriceError, setBookingPriceError] = useState<string | null>(null);
  const [hasArrivedAtPickup, setHasArrivedAtPickup] = useState(false);
  const [showFullscreenAd, setShowFullscreenAd] = useState(true);
  const [showTopAd, setShowTopAd] = useState(true);

  const handleCloseFullscreenAd = useCallback(() => {
    setShowFullscreenAd(false);
  }, []);

  const handleCloseTopAd = useCallback(() => {
    setShowTopAd(false);
  }, []);

  const etaTimeoutRef = useRef<NodeJS.Timeout>();
  const mountedRef = useRef(true);
  const profileRef = useRef(profile);
  const activeRideRef = useRef(activeRide);
  const updateLocationRef = useRef(updateLocation);
  const sendMessageRef = useRef(sendMessage);
  const isOnline = profile?.online || false;
  const isPending = profile?.status === 'PENDING';

  // Refs pour géolocalisation (solution stable)
  const gpsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstRunRef = useRef(true);
  const lastSentPosRef = useRef<LatLng | null>(null);
  const requestLocationRef = useRef<() => Promise<boolean>>();
  const isOnlineRef = useRef(isOnline);
  const gpsDeniedRef = useRef(gpsDenied);

  // Mettre à jour les refs
  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    gpsDeniedRef.current = gpsDenied;
  }, [gpsDenied]);

  // Réservations
  const { data: driverBookings, refetch: refetchBookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ['/api/driver/bookings'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/driver/bookings', { credentials: 'include' });
        if (!res.ok) return [];
        return res.json();
      } catch (err) {
        console.error('Error fetching driver bookings:', err);
        return [];
      }
    },
    refetchInterval: (query) => {
      if (document.visibilityState !== 'visible') return false;
      return 30000;
    },
    refetchIntervalInBackground: false,
    enabled: isOnline && !activeRide,
  });

  // Mise à jour des refs
  useEffect(() => {
    profileRef.current = profile;
    activeRideRef.current = activeRide;
    updateLocationRef.current = updateLocation;
    sendMessageRef.current = sendMessage;
  }, [profile, activeRide, updateLocation, sendMessage]);

  // Toast style
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @media (max-width: 640px) {
        [data-radix-toast-root], [data-sonner-toast], .toast-root, .mobile-toast {
          top: 70px !important;
          bottom: auto !important;
          left: 50% !important;
          transform: translateX(-50%) !important;
          right: auto !important;
          margin: 0 !important;
        }
      }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  useEffect(() => {
    if (driverBookings) {
      setAvailableBookings(driverBookings);
      const newPending = driverBookings.filter(b => b.status === 'PENDING').length;
      if (newPending > 0 && !activeRide && !showBookings) {
        toast({
          title: lang === 'mg' ? "Reservation vaovao!" : "Nouvelle réservation!",
          description: lang === 'mg' ? `${newPending} reservation(s) misy` : `${newPending} réservation(s) disponible(s)`,
          duration: 5000,
          className: "mobile-toast"
        });
      }
    }
  }, [driverBookings, activeRide, showBookings, toast, lang]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const handleRefreshBookings = useCallback(() => {
    refetchBookings();
    toast({ title: lang === 'mg' ? "Havaozina" : "Rafraîchissement", description: lang === 'mg' ? "Fanavaozana ny reservation" : "Mise à jour des réservations", className: "mobile-toast" });
  }, [refetchBookings, toast, lang]);

  // Fonction pour envoyer la position si elle a changé significativement
  const sendLocationIfChanged = useCallback((newPos: LatLng) => {
    if (!profileRef.current?.online) return;
    if (lastSentPosRef.current) {
      const latDiff = Math.abs(newPos.lat - lastSentPosRef.current.lat);
      const lngDiff = Math.abs(newPos.lng - lastSentPosRef.current.lng);
      const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111000;
      if (distance < 200) return;
    }
    lastSentPosRef.current = newPos;
    updateLocationRef.current.mutate(newPos);
  }, []);

  // Récupération unique de la position
  const requestLocation = useCallback(async (): Promise<boolean> => {
    if (!navigator.geolocation) {
      setLocationError(lang === 'mg' ? "Tsy manohana GPS ity navigateur ity" : "Ce navigateur ne supporte pas la géolocalisation");
      setGpsDenied(true);
      return false;
    }
    if (!profileRef.current?.online) return false;
    setIsLocating(true);
    setLocationError(null);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setDriverPos(location);
          setLocationAccuracy(pos.coords.accuracy);
          setLocationError(null);
          setGpsDenied(false);
          setIsLocating(false);
          toast({
            title: lang === 'mg' ? "Toerana hita" : "Position trouvée",
            description: lang === 'mg' ? `Précision: ${Math.round(pos.coords.accuracy)}m` : `Précision: ${Math.round(pos.coords.accuracy)}m`,
            className: "mobile-toast"
          });
          if (profileRef.current?.online && document.visibilityState === 'visible') {
            sendLocationIfChanged(location);
          }
          resolve(true);
        },
        (error) => {
          console.error('GPS error:', error);
          setIsLocating(false);
          let message = '';
          if (error.code === error.PERMISSION_DENIED) {
            message = lang === 'mg' ? "Navela ny GPS" : "GPS refusé";
            setGpsDenied(true);
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            message = lang === 'mg' ? "Tsy hita ny toerana" : "Position indisponible";
          } else if (error.code === error.TIMEOUT) {
            message = lang === 'mg' ? "Lany daty ny GPS" : "Délai dépassé (20s)";
          } else {
            message = error.message;
          }
          setLocationError(message);
          toast({
            variant: "destructive",
            title: lang === 'mg' ? "Tsy hita ny toerana" : "Position non trouvée",
            description: message,
            className: "mobile-toast",
          });
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
      );
    });
  }, [lang, toast, sendLocationIfChanged]);

  // Stocker la fonction requestLocation dans une ref stable
  useEffect(() => {
    requestLocationRef.current = requestLocation;
  }, [requestLocation]);

  // Démarrage périodique (intervalle unique) - uniquement si online et pas gpsDenied
  const startGpsInterval = useCallback(() => {
    if (gpsIntervalRef.current) {
      clearInterval(gpsIntervalRef.current);
      gpsIntervalRef.current = null;
    }
    gpsIntervalRef.current = setInterval(() => {
      if (document.visibilityState === 'visible' && isOnlineRef.current && !gpsDeniedRef.current) {
        if (requestLocationRef.current) {
          requestLocationRef.current();
        }
      }
    }, 60000); // 60 secondes
  }, []);

  // Démarrage initial et arrêt - corrigé pour éviter boucle infinie
  useEffect(() => {
    if (profile?.online && !gpsDenied && !driverPos && isFirstRunRef.current) {
      isFirstRunRef.current = false;
      requestLocation().then(() => {
        if (profileRef.current?.online && document.visibilityState === 'visible') {
          startGpsInterval();
        }
      });
    } else if (!profile?.online || gpsDenied) {
      if (gpsIntervalRef.current) {
        clearInterval(gpsIntervalRef.current);
        gpsIntervalRef.current = null;
      }
    }
    return () => {
      if (gpsIntervalRef.current) {
        clearInterval(gpsIntervalRef.current);
        gpsIntervalRef.current = null;
      }
    };
  }, [profile?.online, gpsDenied, driverPos, requestLocation, startGpsInterval]);

  const formattedPrice = useMemo(() => {
    const price = extractPrice(activeRide);
    return price ? price.toLocaleString('fr-FR') : "0";
  }, [activeRide]);

  useEffect(() => {
    if (activeRide && ['ASSIGNED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'IN_PROGRESS', 'COMPLETED'].includes(activeRide.status)) {
      setShowRideTracking(true);
      if (activeRide.pickupLat && activeRide.pickupLng) setPickupCoords({ lat: parseFloat(activeRide.pickupLat as any), lng: parseFloat(activeRide.pickupLng as any) });
      if (activeRide.dropLat && activeRide.dropLng) setDropoffCoords({ lat: parseFloat(activeRide.dropLat as any), lng: parseFloat(activeRide.dropLng as any) });
      if (activeRide.pickupLat && activeRide.pickupLng && activeRide.dropLat && activeRide.dropLng) {
        const pickup = { lat: parseFloat(activeRide.pickupLat as any), lng: parseFloat(activeRide.pickupLng as any) };
        const dropoff = { lat: parseFloat(activeRide.dropLat as any), lng: parseFloat(activeRide.dropLng as any) };
        fetchOSRMRoute(pickup, dropoff).then(result => { if (result) setRouteCoords(result.coordinates); });
      }
      if (activeRide.status !== 'REQUESTED' && activeRide.status !== 'BIDDING') {
        setOtherUserName(activeRide.passengerName);
        setOtherUserId(activeRide.passengerId);
        setOtherUserPhone(activeRide.passengerPhone);
        setShowChat(true);
        setChatMinimized(false);
      }
    } else if (activeRide && activeRide.status === 'CANCELED') {
      setShowRideTracking(false);
      setTimerStarted(false);
      setStartTime(null);
      setRouteCoords(undefined);
      setPickupCoords(null);
      setDropoffCoords(null);
      setShowChat(false);
      setChatMinimized(false);
    }
  }, [activeRide]);

  const driverMarkers = useMemo(() => {
    if (!driverPos || !profile) return [];
    return [{
      lat: driverPos.lat, lng: driverPos.lng,
      name: profile?.name || 'Toerako',
      vehicleType: profile?.vehicleType,
      isDriverStart: true,
    }];
  }, [driverPos, profile]);

  const pickupMarkers = useMemo(() => {
    const markers = requests.map((r: any) => ({ lat: parseFloat(r.pickupLat as any), lng: parseFloat(r.pickupLng as any) }));
    if (activeRide && ['IN_PROGRESS'].includes(activeRide.status) && activeRide.pickupLat) markers.push({ lat: parseFloat(activeRide.pickupLat as any), lng: parseFloat(activeRide.pickupLng as any) });
    return markers;
  }, [requests, activeRide]);

  const handleStartJourney = async () => {
    if (!activeRide || isUpdating) return;
    try {
      setIsUpdating(true);
      let nextStatus = '';
      switch (activeRide.status) {
        case 'ASSIGNED': nextStatus = 'DRIVER_EN_ROUTE'; break;
        case 'DRIVER_EN_ROUTE': nextStatus = 'DRIVER_ARRIVED'; break;
        case 'DRIVER_ARRIVED': nextStatus = 'IN_PROGRESS'; break;
        case 'IN_PROGRESS': nextStatus = 'COMPLETED'; break;
        default: console.warn(`Unknown status: ${activeRide.status}`); setIsUpdating(false); return;
      }
      if (activeRide.status === nextStatus) { setIsUpdating(false); return; }
      const response = await fetch(`/api/rides/${activeRide.id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: nextStatus }) });
      if (!response.ok) { const error = await response.json(); throw new Error(error.message || 'Failed to update ride status'); }
      const updatedRide = await response.json();
      queryClient.setQueryData(['/api/driver/active-ride'], updatedRide);
      toast({ title: lang === 'mg' ? "Status novaina" : "Statut mis à jour", description: getStatusLabel(nextStatus), className: "mobile-toast" });
    } catch (error: any) {
      console.error('ERROR in handleStartJourney:', error);
      toast({ variant: "destructive", title: lang === 'mg' ? "Tsy nety" : "Erreur", description: error.message, className: "mobile-toast" });
    } finally { setIsUpdating(false); }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'DRIVER_EN_ROUTE': lang === 'mg' ? 'Eny an-dalana' : 'En route',
      'DRIVER_ARRIVED': lang === 'mg' ? 'Tonga' : 'Arrivé',
      'IN_PROGRESS': lang === 'mg' ? 'An-dalana' : 'En course',
      'COMPLETED': lang === 'mg' ? 'Vita' : 'Terminé',
    };
    return labels[status] || status;
  };

  const handleCompleteRide = async () => {
    if (!activeRide || isUpdating) return;
    if (activeRide.status === 'COMPLETED') { setShowCompletionConfirm(false); return; }
    try {
      setIsUpdating(true);
      const response = await fetch(`/api/rides/${activeRide.id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ status: 'COMPLETED' }) });
      if (!response.ok) { const errorData = await response.json().catch(() => ({})); throw new Error(errorData.message || 'Failed to complete ride'); }
      setShowCompletionConfirm(false);
      setTimerStarted(false);
      setStartTime(null);
      queryClient.invalidateQueries({ queryKey: ['/api/driver/active-ride'] });
      queryClient.invalidateQueries({ queryKey: ['/api/driver/requests'] });
      toast({ title: lang === 'mg' ? "Vita ny dia!" : "Course terminée!", description: lang === 'mg' ? `Voaray ${formattedPrice} Ar` : `${formattedPrice} Ar reçus`, className: "mobile-toast" });
      setShowChat(false);
      setChatMinimized(false);
    } catch (error: any) {
      console.error('Error completing ride:', error);
      toast({ variant: "destructive", title: lang === 'mg' ? "Tsy nety" : "Erreur", description: error.message, className: "mobile-toast" });
    } finally { setIsUpdating(false); }
  };

  const handleCancelRide = async () => {
    if (!activeRide) return;
    toast({ variant: "destructive", title: lang === 'mg' ? "Nofoanana" : "Annulé", description: lang === 'mg' ? "Voafafa ny dia" : "Course annulée", className: "mobile-toast" });
    setShowRideTracking(false);
    setTimerStarted(false);
    setStartTime(null);
    setShowChat(false);
    setChatMinimized(false);
    refresh();
  };

  const validatePrice = useCallback((value: string): string | null => {
    if (!value) return null;
    const num = Number(value);
    if (isNaN(num) || num < 1000) return lang === 'mg' ? "1000 Ar ny farany ambany" : "Minimum 1000 Ar";
    if (num > 1000000) return lang === 'mg' ? "Lafo loatra" : "Trop élevé";
    return null;
  }, [lang]);

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPrice(value);
    setPriceError(value ? validatePrice(value) : null);
  };

  const handleSendOffer = async () => {
    if (!selectedRequest || !price) {
      toast({ variant: "destructive", title: lang === 'mg' ? "Tsy feno" : "Incomplet", description: lang === 'mg' ? "Ampidiro ny vidiny" : "Entrez le prix", className: "mobile-toast" });
      return;
    }
    const error = validatePrice(price);
    if (error) {
      setPriceError(error);
      toast({ variant: "destructive", title: lang === 'mg' ? "Tsy nety" : "Erreur", description: error, className: "mobile-toast" });
      return;
    }
    const eta = autoEta || selectedRequest?.etaMinutes || 5;
    try {
      await sendOffer.mutateAsync({ rideId: selectedRequest.id, priceAr: parseInt(price), etaMinutes: eta });
      if (!mountedRef.current) return;
      setOfferSentFor(prev => new Set(prev).add(selectedRequest.id));
      setSelectedRequest(null);
      setPrice('');
      setPriceError(null);
      setAutoEta(null);
      setCalculatingEta(false);
      refresh();
      toast({ title: lang === 'mg' ? 'Tolobidy nalefa!' : 'Offre envoyée !', description: `Ar ${price} - ${eta} min`, className: "mobile-toast" });
    } catch (err: any) {
      if (!mountedRef.current) return;
      toast({ variant: "destructive", title: lang === 'mg' ? "Tsy nety" : "Erreur", description: err.message || (lang === 'mg' ? "Tsy afaka nandefa ny tolobidy" : "Impossible d'envoyer l'offre"), className: "mobile-toast" });
    }
  };

  const sendBookingOffer = useMutation({
    mutationFn: async ({ bookingId, priceAr, etaMinutes }: { bookingId: number; priceAr: number; etaMinutes: number }) => {
      const res = await apiFetch(`/api/bookings/${bookingId}/offers`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceAr, etaMinutes }),
        credentials: 'include',
      });
      if (!res.ok) { const error = await res.json(); throw new Error(error.message || "Failed to send offer"); }
      return res.json();
    },
    onSuccess: (_, { priceAr, etaMinutes }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/driver/bookings'] });
      toast({ title: lang === 'mg' ? "Tolobidy nalefa!" : "Offre envoyée!", description: `${priceAr} Ar - ${etaMinutes} min`, className: "mobile-toast" });
      setSelectedBooking(null);
      setBookingPrice('');
      refetchBookings();
    },
    onError: (error: Error) => { toast({ variant: "destructive", title: lang === 'mg' ? "Tsy nety" : "Erreur", description: error.message, className: "mobile-toast" }); },
  });

  const handleSendBookingOffer = async () => {
    if (!selectedBooking || !bookingPrice) {
      toast({ variant: "destructive", title: lang === 'mg' ? "Tsy feno" : "Incomplet", description: "Entrez le prix", className: "mobile-toast" });
      return;
    }
    const error = validatePrice(bookingPrice);
    if (error) { setBookingPriceError(error); return; }
    const eta = autoEta || selectedBooking?.etaMinutes || 10;
    await sendBookingOffer.mutateAsync({ bookingId: selectedBooking.id, priceAr: parseInt(bookingPrice), etaMinutes: eta });
  };

  const handleStartBookingRide = async () => {
    if (!activeRide || !activeRide.bookingId) return;
    try {
      setIsUpdating(true);
      const response = await fetch(`/api/bookings/${activeRide.bookingId}/start-ride`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
      if (!response.ok) { const error = await response.json(); throw new Error(error.message || 'Failed to start booking ride'); }
      const newRide = await response.json();
      queryClient.setQueryData(['/api/driver/active-ride'], newRide);
      toast({ title: lang === 'mg' ? "Reservation nanomboka!" : "Réservation démarrée!", description: "Course en cours", className: "mobile-toast" });
    } catch (error: any) {
      toast({ variant: "destructive", title: lang === 'mg' ? "Tsy nety" : "Erreur", description: error.message, className: "mobile-toast" });
    } finally { setIsUpdating(false); }
  };

  const openGoogleMapsNavigation = useCallback(() => {
    if (!driverPos) {
      toast({ variant: "destructive", title: lang === 'mg' ? "Tsy hita ny toerana misy anao" : "Position non trouvée", description: "Veuillez patienter.", className: "mobile-toast" });
      return;
    }
    let origin: string, destination: string;
    const isArrived = activeRide?.status === 'DRIVER_ARRIVED' || hasArrivedAtPickup;
    if (isArrived) {
      if (!activeRide?.dropLat || !activeRide?.dropLng) {
        toast({ variant: "destructive", title: "Destination non trouvée", className: "mobile-toast" });
        return;
      }
      origin = `${activeRide.pickupLat},${activeRide.pickupLng}`;
      destination = `${activeRide.dropLat},${activeRide.dropLng}`;
    } else {
      if (!activeRide?.pickupLat || !activeRide?.pickupLng) {
        toast({ variant: "destructive", title: "Point de départ non trouvé", className: "mobile-toast" });
        return;
      }
      origin = `${driverPos.lat},${driverPos.lng}`;
      destination = `${activeRide.pickupLat},${activeRide.pickupLng}`;
    }
    const encodedOrigin = encodeURIComponent(origin);
    const encodedDestination = encodeURIComponent(destination);
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = `https://www.google.com/maps/dir/?api=1&origin=${encodedOrigin}&destination=${encodedDestination}&travelmode=driving&dir_action=navigate`;
    } else {
      window.open(`https://www.google.com/maps/dir/${encodedOrigin}/${encodedDestination}`, '_blank');
    }
  }, [driverPos, activeRide, lang, toast, hasArrivedAtPickup]);

  useEffect(() => {
    if (etaTimeoutRef.current) clearTimeout(etaTimeoutRef.current);
    if (!selectedRequest) { setAutoEta(null); setCalculatingEta(false); return; }
    const defaultEta = selectedRequest.etaMinutes || 5;
    setAutoEta(defaultEta);
    if (driverPos) {
      const pickupLat = parseFloat(selectedRequest.pickupLat);
      const pickupLng = parseFloat(selectedRequest.pickupLng);
      if (!isNaN(pickupLat) && !isNaN(pickupLng)) {
        setCalculatingEta(true);
        etaTimeoutRef.current = setTimeout(() => {
          fetchOSRMRoute(driverPos, { lat: pickupLat, lng: pickupLng })
            .then(result => { if (result && result.durationMin) setAutoEta(Math.round(result.durationMin)); })
            .catch(() => {})
            .finally(() => setCalculatingEta(false));
        }, 500);
      }
    }
    return () => { if (etaTimeoutRef.current) clearTimeout(etaTimeoutRef.current); };
  }, [selectedRequest?.id, driverPos]);

  useEffect(() => {
    if (activeRide && (activeRide.status === 'COMPLETED' || activeRide.status === 'CANCELED')) { setShowChat(false); setChatMinimized(false); }
  }, [activeRide]);

  const mapCenter = useMemo(() => {
    if (activeRide) return driverPos || GEOCENTER;
    if (requests.length > 0 && requests[0]?.pickupLat) return { lat: parseFloat(requests[0].pickupLat as any), lng: parseFloat(requests[0].pickupLng as any) };
    return driverPos || GEOCENTER;
  }, [requests, driverPos, activeRide]);

  const handleToggleOnline = useCallback((checked: boolean) => {
    if (checked && (!driverPos || gpsDenied)) {
      toast({ variant: "destructive", title: lang === 'mg' ? "Tsy azo atao" : "Impossible", description: lang === 'mg' ? "Mila mamela ny GPS aloha ianao" : "Activez d'abord la localisation GPS", className: "mobile-toast" });
      return;
    }
    setOnline.mutate(checked);
  }, [driverPos, gpsDenied, setOnline, toast, lang]);

  if (profileLoading) {
    return (
      <MobileLayout role="driver">
        <div className="flex h-screen items-center justify-center"><LoadingAnimation /></div>
      </MobileLayout>
    );
  }

  if (!profile || isPending) {
    return (
      <MobileLayout role="driver">
        <div className="p-4 pt-20 space-y-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Card className="p-6 rounded-2xl text-center">
              <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold font-display mb-2">{lang === 'mg' ? 'Miandry fankatoavana' : 'En attente de validation'}</h2>
              <p className="text-muted-foreground mb-4">{lang === 'mg' ? 'Ny antontan-taratasinao dia mbola jerena.' : 'Vos documents sont en cours de vérification.'}</p>
              <Button onClick={() => setLocation('/driver/documents')} className="rounded-xl">{lang === 'mg' ? 'Jereo ny antontan-taratasy' : 'Voir mes documents'}</Button>
            </Card>
          </motion.div>
        </div>
      </MobileLayout>
    );
  }

  return (
    <>
      {showFullscreenAd && <FullscreenAd onClose={handleCloseFullscreenAd} delay={1000} />}
      <MobileLayout role="driver">
        <RefreshIndicator isRefreshing={isRefreshing} />

        {gpsDenied && (
          <div className="absolute top-36 left-1/2 -translate-x-1/2 z-20 w-64">
            <Alert variant="destructive" className="rounded-xl shadow-lg">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                {lang === 'mg' ? 'Mila ny toerana misy anao ny fampiharana. Azafady, omeo alalana ny GPS.' : 
                'L\'application a besoin de votre position. Veuillez autoriser la géolocalisation.'}
              </AlertDescription>
              <Button 
                size="sm" 
                variant="outline" 
                className="mt-2 w-full rounded-lg"
                onClick={() => {
                  setGpsDenied(false);
                  requestLocation();
                }}
              >
                {lang === 'mg' ? 'Andramo indray' : 'Réessayer'}
              </Button>
            </Alert>
          </div>
        )}

        <div className="absolute inset-0 z-0 pt-16">
          <MapView center={mapCenter} zoom={16} interactive={true} markers={pickupMarkers} driverMarkers={driverMarkers} pickupMarker={pickupCoords} dropoffMarker={dropoffCoords} showRoute={!!routeCoords} routeCoordinates={routeCoords} pickupVehicleType={activeRide?.vehicleType} />
        </div>

        <div className="absolute top-4 left-4 z-10">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${connected ? 'bg-green-500/20 text-green-700' : 'bg-red-500/20 text-red-700'}`}>
            {connected ? <><Wifi className="w-3 h-3" />{lang === 'mg' ? 'Mifandray' : 'Connecté'}</> : <><WifiOff className="w-3 h-3" />{lang === 'mg' ? 'Tsy mifandray' : 'Déconnecté'}</>}
          </motion.div>
        </div>

        <div className="absolute top-24 left-0 right-0 z-20 px-3 pointer-events-none">
          <div className="pointer-events-auto">
            {showTopAd && <AdBanner position="HOME_TOP" onClose={handleCloseTopAd} />}
          </div>
        </div>

        <div className="absolute top-4 left-28 z-10">
          <motion.div className={`px-2 py-1 rounded-full text-[10px] font-medium flex items-center gap-1 ${driverPos ? 'bg-blue-500/20 text-blue-700' : 'bg-red-500/20 text-red-700'}`}>
            <LocateFixed className="w-3 h-3" />
            {driverPos ? (lang === 'mg' ? `GPS: ${locationAccuracy ? Math.round(locationAccuracy) + 'm' : 'OK'}` : `GPS: ${locationAccuracy ? Math.round(locationAccuracy) + 'm' : 'OK'}`) : (lang === 'mg' ? 'Mitady GPS...' : 'Recherche GPS...')}
            {isLocating && <Loader2 className="w-2.5 h-2.5 animate-spin ml-1" />}
          </motion.div>
        </div>

        <div className="absolute top-4 right-4 z-10">
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => requestLocation()} className="p-2 rounded-full bg-background/90 backdrop-blur-sm shadow-lg border border-border/30" disabled={isLocating}>
            <Crosshair className={`w-4 h-4 ${isLocating ? 'animate-pulse text-primary' : 'text-muted-foreground'}`} />
          </motion.button>
        </div>

        <div className="absolute top-16 right-4 z-10">
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
            <Card className="px-4 py-2 rounded-full shadow-lg flex items-center space-x-3 bg-background/90 backdrop-blur-sm border-0">
              <span className="font-bold text-sm">{isOnline ? (lang === 'mg' ? 'Miasa' : 'En ligne') : (lang === 'mg' ? 'Tsy miasa' : 'Hors ligne')}</span>
              <Switch checked={isOnline} onCheckedChange={handleToggleOnline} disabled={!driverPos || gpsDenied} className="data-[state=checked]:bg-green-500" />
            </Card>
          </motion.div>
        </div>

        {isOnline && !activeRide && (
          <div className="absolute top-28 right-4 z-10 flex gap-2">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
              <Button variant="default" size="sm" className="rounded-full shadow-lg bg-amber-500 hover:bg-amber-600" onClick={() => setShowBookings(!showBookings)}>
                <Calendar className="w-4 h-4 mr-1" /> {availableBookings.length} {lang === 'mg' ? 'Reservation' : 'Réserv'}
              </Button>
            </motion.div>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1 }}>
              <Button variant="outline" size="sm" className="rounded-full shadow-lg bg-background/80" onClick={handleRefreshBookings} disabled={bookingsLoading}>
                <RefreshCw className={`w-4 h-4 ${bookingsLoading ? 'animate-spin' : ''}`} />
              </Button>
            </motion.div>
          </div>
        )}

        {locationError && (
          <div className="absolute top-36 left-1/2 -translate-x-1/2 z-10">
            <Alert variant="destructive" className="rounded-full py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{locationError}</AlertDescription>
            </Alert>
          </div>
        )}

        <AnimatePresence>
          {showRideTracking && activeRide && (
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="absolute bottom-0 w-full z-20 p-4">
              <Card className="p-5 rounded-3xl shadow-2xl border-0 bg-background/95 backdrop-blur-xl">
                <div className="flex justify-between items-center mb-4">
                  <div><Badge className="mb-2" variant={activeRide.status === 'IN_PROGRESS' ? 'default' : 'outline'}>{activeRide.status === 'ASSIGNED' && (lang === 'mg' ? 'Voatendry' : 'Assigné')}{activeRide.status === 'DRIVER_EN_ROUTE' && (lang === 'mg' ? 'Eny an-dalana' : 'En route')}{activeRide.status === 'DRIVER_ARRIVED' && (lang === 'mg' ? 'Tonga' : 'Arrivé')}{activeRide.status === 'IN_PROGRESS' && (lang === 'mg' ? 'An-dalana' : 'En cours')}{activeRide.status === 'COMPLETED' && (lang === 'mg' ? 'Vita' : 'Terminé')}</Badge><h3 className="font-display font-bold text-xl">{formattedPrice} Ar</h3></div>
                  <div className="text-right"><div className="text-3xl font-bold font-mono text-primary">{String(activeRide.etaMinutes).padStart(2, '0')}:00</div><p className="text-xs text-muted-foreground">{lang === 'mg' ? 'sisa' : 'restant'}</p></div>
                </div>
                <div className="bg-secondary/50 rounded-2xl p-4 mb-4">
                  <div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center"><User className="w-5 h-5 text-primary" /></div><div><p className="font-bold">{activeRide.passengerName}</p>{activeRide.passengerPhone && (<a href={`tel:${activeRide.passengerPhone}`} className="text-xs text-primary flex items-center gap-1"><Phone className="w-3 h-3" />{activeRide.passengerPhone}</a>)}</div></div><Button variant="outline" size="sm" onClick={() => { setOtherUserName(activeRide.passengerName); setOtherUserId(activeRide.passengerId); setOtherUserPhone(activeRide.passengerPhone); setShowChat(true); setChatMinimized(false); }} className="rounded-full"><MessageCircle className="w-4 h-4 mr-1" />{lang === 'mg' ? 'Hiresaka' : 'Chat'}</Button></div>
                  <div className="space-y-2 mt-3"><p className="text-xs flex items-start gap-2"><MapPin className="w-3 h-3 text-green-500 mt-0.5 shrink-0" /><span className="text-muted-foreground line-clamp-2">{activeRide.pickupAddress}</span></p><p className="text-xs flex items-start gap-2"><Navigation className="w-3 h-3 text-red-400 mt-0.5 shrink-0" /><span className="text-muted-foreground line-clamp-2">{activeRide.dropAddress}</span></p></div>
                </div>
                <Button onClick={openGoogleMapsNavigation} className="w-auto mx-auto h-10 mb-3 rounded-xl font-bold flex items-center justify-center gap-2 px-6 transition-all">{activeRide.status === 'DRIVER_ARRIVED' || hasArrivedAtPickup ? (lang === 'mg' ? 'Navigue mankany amin\'ny toerana alehana' : 'Naviguer vers la destination') : (lang === 'mg' ? 'Navigue mankany amin\'ny toerana fiaingana' : 'Naviguer vers le point de départ')}</Button>
                <div className="flex justify-center">
                  {activeRide.status === 'ASSIGNED' && (<Button onClick={handleStartJourney} className="w-auto mx-auto h-12 px-8 text-base font-bold rounded-xl" disabled={updateRideStatus.isPending}>{updateRideStatus.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}{lang === 'mg' ? 'Manomboka ny dia' : 'Commencer la course'}</Button>)}
                  {activeRide.status === 'DRIVER_EN_ROUTE' && (<Button onClick={handleStartJourney} className="w-auto mx-auto h-12 text-base font-bold rounded-xl bg-blue-600 hover:bg-blue-700"><MapPin className="w-4 h-4 mr-2" />{lang === 'mg' ? 'Tonga teo amin\'ny toerana' : 'Arrivé au point de départ'}</Button>)}
                  {activeRide.status === 'DRIVER_ARRIVED' && (<Button onClick={handleStartJourney} className="w-auto mx-auto h-12 text-base font-bold rounded-xl bg-green-600 hover:bg-green-700"><Play className="w-4 h-4 mr-2" />{lang === 'mg' ? 'Manomboka ny dia' : 'Démarrer la course'}</Button>)}
                  {activeRide.status === 'IN_PROGRESS' && (<Button onClick={() => setShowCompletionConfirm(true)} className="w-auto mx-auto h-12 text-base font-bold rounded-xl bg-green-600 hover:bg-green-700" disabled={updateRideStatus.isPending}>{updateRideStatus.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}{lang === 'mg' ? 'Vita ny dia' : 'Terminer la course'}</Button>)}
                  {activeRide.status !== 'COMPLETED' && activeRide.status !== 'CANCELED' && (<Button onClick={handleCancelRide} variant="ghost" className="w-auto mx-auto text-destructive hover:text-destructive hover:bg-destructive/10"><XCircle className="w-4 h-4 mr-2" />{lang === 'mg' ? 'Mamafa ny dia' : 'Annuler la course'}</Button>)}
                  {activeRide.status === 'ASSIGNED' && activeRide.isBooking && (<Button onClick={handleStartBookingRide} className="w-auto mx-auto h-12 text-base font-bold rounded-xl bg-amber-600 hover:bg-amber-700"><Calendar className="w-4 h-4 mr-2" />{lang === 'mg' ? 'Manomboka ny reservation' : 'Démarrer la réservation'}</Button>)}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <Dialog open={showCompletionConfirm} onOpenChange={setShowCompletionConfirm}>
          <DialogContent className="rounded-3xl max-w-sm mx-auto">
            <DialogHeader><DialogTitle className="text-center font-display text-xl">{lang === 'mg' ? 'Vita ve ny dia?' : 'Course terminée?'}</DialogTitle></DialogHeader>
            <div className="py-4 text-center"><CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-3" /><p className="text-lg font-bold text-primary mb-1">{formattedPrice} Ar</p><p className="text-sm text-muted-foreground">{lang === 'mg' ? 'Tafiditra ao ny vola voaray' : 'Ce montant sera crédité sur votre compte'}</p></div>
            <DialogFooter className="flex gap-2"><Button variant="outline" onClick={() => setShowCompletionConfirm(false)} className="flex-1">{lang === 'mg' ? 'Hiverina' : 'Retour'}</Button><Button onClick={handleCompleteRide} className="flex-1 bg-green-600 hover:bg-green-700" disabled={updateRideStatus.isPending}>{updateRideStatus.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (lang === 'mg' ? 'Eny, vita' : 'Oui, terminé')}</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <AnimatePresence>
          {isOnline && !activeRide && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="absolute bottom-0 w-full z-10 p-4 max-h-[50vh] overflow-y-auto space-y-3">
              {requestsLoading ? (
                <div className="p-4 text-center bg-background/80 backdrop-blur-md rounded-2xl"><Loader2 className="w-6 h-6 text-primary animate-spin" /><p className="text-sm text-muted-foreground mt-2">{lang === 'mg' ? 'Mitady...' : 'Recherche...'}</p></div>
              ) : requests.length === 0 ? (
                <motion.div className="p-6 text-center bg-background/80 backdrop-blur-md rounded-2xl"><Navigation className="w-12 h-12 text-primary mx-auto mb-3 opacity-50" /><p className="font-medium">{lang === 'mg' ? 'Tsy misy fangatahana' : 'Aucune demande'}</p><p className="text-sm text-muted-foreground">{lang === 'mg' ? 'Miandrasa...' : 'En attente...'}</p></motion.div>
              ) : (
                requests.map((req: any, index: number) => {
                  const isOfferSent = offerSentFor.has(req.id);
                  const VehicleIcon = VEHICLE_TYPES.find(v => v.id === req.vehicleType)?.icon || Car;
                  return (
                    <motion.div key={req.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }}>
                      <Card className={`p-4 rounded-2xl shadow-float border-0 bg-background/95 backdrop-blur-xl ${isOfferSent ? 'opacity-75' : ''}`}>
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold flex items-center text-sm"><MapPin className="w-4 h-4 mr-1 text-green-500 shrink-0"/><span className="truncate">{req.pickupAddress}</span></p>
                            <p className="text-sm text-muted-foreground flex items-center mt-1"><Navigation className="w-4 h-4 mr-1 shrink-0 text-red-400"/><span className="truncate">{req.dropAddress}</span></p>
                            {req.passenger?.name && (<div className="flex items-center gap-2 mt-2"><User className="w-3 h-3 text-muted-foreground" /><span className="text-xs font-medium">{req.passenger.name}</span>{req.passenger?.phone && (<a href={`tel:${req.passenger.phone}`} className="text-xs text-primary font-semibold flex items-center gap-0.5 hover:underline"><Phone className="w-3 h-3" /> {lang === 'mg' ? 'Antsoy' : 'Appeler'}</a>)}</div>)}
                            {(req.distanceKm || req.etaMinutes) && (<div className="flex gap-2 mt-2">{req.distanceKm && <Badge variant="secondary" className="text-[10px] gap-1"><Route className="w-2.5 h-2.5" /> {parseFloat(req.distanceKm).toFixed(1)} km</Badge>}{req.etaMinutes && <Badge variant="secondary" className="text-[10px] gap-1"><Clock className="w-2.5 h-2.5" /> ~{req.etaMinutes} min</Badge>}</div>)}
                          </div>
                          <Badge className="ml-2 shrink-0 flex items-center gap-1"><VehicleIcon className="w-3 h-3" />{req.vehicleType === 'TAXI' ? 'Taxi' : req.vehicleType === 'BAJAJ' ? 'Bajaj' : req.vehicleType === 'CAMION' ? 'Camion' : '4x4'}</Badge>
                        </div>
                        {isOfferSent ? (<div className="w-full mt-2 h-10 rounded-xl bg-green-500/10 text-green-600 font-bold text-sm flex items-center justify-center gap-2"><CheckCircle className="w-4 h-4" />{lang === 'mg' ? 'Tolobidy nalefa' : 'Offre envoyée'}</div>) : (<Button onClick={() => { setSelectedRequest(req); setPrice(''); setPriceError(null); }} className="w-auto mx-auto mt-2 font-bold rounded-xl"><Send className="w-4 h-4 mr-2" />{lang === 'mg' ? 'Handefa tolo-bidy' : 'Envoyer offre'}</Button>)}
                      </Card>
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <Dialog open={!!selectedRequest && !activeRide} onOpenChange={(open) => { if (!open) { setSelectedRequest(null); setPrice(''); setPriceError(null); setAutoEta(null); setCalculatingEta(false); if (etaTimeoutRef.current) clearTimeout(etaTimeoutRef.current); } }}>
          <DialogContent className="rounded-3xl sm:rounded-3xl border-0 shadow-2xl max-w-sm mx-auto">
            <DialogHeader><DialogTitle className="font-display text-xl">{lang === 'mg' ? 'Handefa tolo-bidy' : 'Envoyer offre'}</DialogTitle></DialogHeader>
            {selectedRequest && (<div className="space-y-4"><div className="text-xs bg-secondary/50 rounded-xl p-3 space-y-2"><p className="flex items-center gap-1"><MapPin className="w-3 h-3 text-green-500"/><span className="line-clamp-1">{selectedRequest.pickupAddress}</span></p><p className="flex items-center gap-1"><Navigation className="w-3 h-3 text-red-400"/><span className="line-clamp-1">{selectedRequest.dropAddress}</span></p><div className="flex items-center gap-1 mt-2 pt-2 border-t"><Clock className="w-3 h-3 text-primary"/>{calculatingEta ? (<><Loader2 className="w-3 h-3 animate-spin ml-1" /><span className="text-xs text-muted-foreground ml-1">{lang === 'mg' ? 'Manatsara...' : 'Optimisation...'} ({autoEta || selectedRequest?.etaMinutes || 5} min)</span></>) : (<span className="font-semibold">{lang === 'mg' ? `Fotoana: ~${autoEta || selectedRequest?.etaMinutes || 5} min` : `Temps: ~${autoEta || selectedRequest?.etaMinutes || 5} min`}</span>)}</div></div><div><label className="text-sm font-semibold mb-1.5 block">{lang === 'mg' ? 'Vidiny (Ar)' : 'Prix (Ar)'}</label><Input type="text" value={price} onChange={handlePriceChange} placeholder="5000" className={`h-12 text-lg rounded-xl ${priceError ? 'border-destructive' : ''}`} inputMode="numeric" />{priceError && <p className="text-xs text-destructive mt-1">{priceError}</p>}<p className="text-xs text-muted-foreground mt-1">{lang === 'mg' ? '1000 Ar ny farany ambany' : 'Minimum: 1000 Ar'}</p></div></div>)}
            <DialogFooter><Button onClick={handleSendOffer} disabled={!price || sendOffer.isPending} className="w-auto mx-auto h-12 text-lg font-bold rounded-xl">{sendOffer.isPending ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />{lang === 'mg' ? 'Mandefa...' : 'Envoi...'}</>) : (lang === 'mg' ? 'Andefa tolobidy' : 'Envoyer l\'offre')}</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showBookings && !activeRide} onOpenChange={setShowBookings}>
          <DialogContent className="rounded-3xl max-w-md mx-auto max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-xl flex items-center justify-between">
                <span className="flex items-center gap-2"><Calendar className="w-5 h-5 text-primary" />{lang === 'mg' ? 'Reservation misy' : 'Réservations disponibles'}</span>
                <Button variant="ghost" size="sm" onClick={handleRefreshBookings} disabled={bookingsLoading}><RefreshCw className={`w-4 h-4 ${bookingsLoading ? 'animate-spin' : ''}`} /></Button>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {bookingsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : availableBookings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground"><Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>{lang === 'mg' ? 'Tsy misy reservation' : 'Aucune réservation'}</p></div>
              ) : (
                availableBookings.map((booking: any) => {
                  const VehicleIcon = VEHICLE_TYPES.find(v => v.id === booking.vehicleType)?.icon || Car;
                  return (
                    <Card key={booking.id} className="p-4 rounded-2xl cursor-pointer hover:border-primary transition-all" onClick={() => setSelectedBooking(booking)}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex gap-2">
                          <Badge variant="outline" className="text-[10px] flex items-center gap-1"><VehicleIcon className="w-2.5 h-2.5" />{booking.vehicleType === 'TAXI' ? 'Taxi' : booking.vehicleType === 'BAJAJ' ? 'Bajaj' : booking.vehicleType === 'CAMION' ? 'Camion' : '4x4'}</Badge>
                          {booking.status === 'CONFIRMED' && <Badge className="text-[10px] bg-green-100 text-green-700">Acceptée</Badge>}
                          {booking.status === 'PENDING' && <Badge className="text-[10px] bg-amber-100 text-amber-700">En attente</Badge>}
                        </div>
                        <span className="text-xs text-muted-foreground">{new Date(booking.scheduledFor).toLocaleDateString()}</span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs flex items-center gap-1"><MapPin className="w-3 h-3 text-green-500" /><span className="truncate">{booking.pickupAddress}</span></p>
                        <p className="text-xs flex items-center gap-1"><Navigation className="w-3 h-3 text-red-400" /><span className="truncate">{booking.dropAddress}</span></p>
                      </div>
                      <div className="mt-2 pt-2 border-t flex justify-between items-center text-xs">
                        <span>{booking.passenger?.name}</span>
                        {booking.finalPriceAr ? <span className="font-bold text-primary">{booking.finalPriceAr.toLocaleString()} Ar</span> : booking.estimatedPriceAr && <span className="font-bold text-primary">{booking.estimatedPriceAr.toLocaleString()} Ar</span>}
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!selectedBooking && !activeRide} onOpenChange={() => setSelectedBooking(null)}>
          <DialogContent className="rounded-3xl max-w-sm mx-auto">
            <DialogHeader><DialogTitle className="font-display text-xl">{lang === 'mg' ? 'Manolotra reservation' : 'Faire une offre'}</DialogTitle></DialogHeader>
            {selectedBooking && (
              <div className="space-y-4">
                <div className="text-xs bg-secondary/50 rounded-xl p-3 space-y-2">
                  <p className="flex items-center gap-1"><MapPin className="w-3 h-3 text-green-500"/><span className="line-clamp-1">{selectedBooking.pickupAddress}</span></p>
                  <p className="flex items-center gap-1"><Navigation className="w-3 h-3 text-red-400"/><span className="line-clamp-1">{selectedBooking.dropAddress}</span></p>
                  <p className="flex items-center gap-1"><Calendar className="w-3 h-3 text-primary"/><span>{new Date(selectedBooking.scheduledFor).toLocaleString()}</span></p>
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1.5 block">{lang === 'mg' ? 'Vidiny (Ar)' : 'Prix (Ar)'}</label>
                  <Input type="text" value={bookingPrice} onChange={(e) => { setBookingPrice(e.target.value); const error = validatePrice(e.target.value); setBookingPriceError(error); }} placeholder="5000" className={`h-12 text-lg rounded-xl ${bookingPriceError ? 'border-destructive' : ''}`} inputMode="numeric" />
                  {bookingPriceError && <p className="text-xs text-destructive mt-1">{bookingPriceError}</p>}
                  <p className="text-xs text-muted-foreground mt-1">{lang === 'mg' ? '1000 Ar ny farany ambany' : 'Minimum: 1000 Ar'}</p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={handleSendBookingOffer} disabled={!bookingPrice || sendBookingOffer.isPending} className="w-auto mx-auto h-12 text-lg font-bold rounded-xl">
                {sendBookingOffer.isPending ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />{lang === 'mg' ? 'Mandefa...' : 'Envoi...'}</>) : (lang === 'mg' ? 'Andefa tolobidy' : 'Envoyer l\'offre')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AnimatePresence>
          {showChat && activeRide && (
            <ChatBox rideId={activeRide.id} currentUserId={profile?.userId || 0} otherUserId={otherUserId} otherUserName={otherUserName} otherUserPhone={otherUserPhone} isOpen={showChat} minimized={chatMinimized} onClose={() => { setShowChat(false); setChatMinimized(false); }} onMinimize={() => setChatMinimized(true)} />
          )}
        </AnimatePresence>
      </MobileLayout>
    </>
  );
}