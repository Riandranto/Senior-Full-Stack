// src/pages/passenger/Home.tsx
import { useState, useCallback, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import { MobileLayout } from '@/components/RoleLayout';
import { MapView, LatLng, fetchOSRMRoute } from '@/components/Map';
import { useCreateRide } from '@/hooks/use-passenger';
import { RefreshIndicator } from '@/components/RefreshIndicator';
import { LoadingAnimation } from '@/components/LoadingAnimation';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { saveUnknownSearch } from '@/lib/unknown-searches';
import {
  MapPin, Navigation, Car, Bike, Crosshair, X, Loader2, LocateFixed,
  Route, Calendar, Clock, Truck, Gauge,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GEOCENTER } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { AdBanner } from '@/components/AdBanner';
import { useWebSocket } from '@/hooks/use-websocket';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FullscreenAd } from '@/components/FullscreenAd';

// Stockage local pour recherches non trouvées
const STORAGE_KEY = 'farady_unknown_searches';

interface UnknownSearch {
  query: string;
  timestamp: number;
  type: 'pickup' | 'dropoff';
}

const saveUnknownSearch = (query: string, type: 'pickup' | 'dropoff') => {
  try {
    const existing: UnknownSearch[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const newSearch: UnknownSearch = { query, timestamp: Date.now(), type };
    existing.unshift(newSearch);
    const trimmed = existing.slice(0, 100);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    console.log('Unknown search saved:', { query, type });
  } catch (e) {
    console.error('Failed to save unknown search:', e);
  }
};

export const getUnknownSearches = (): UnknownSearch[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
};

export const clearUnknownSearches = () => {
  localStorage.removeItem(STORAGE_KEY);
};

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  class?: string;
  address?: {
    road?: string;
    hamlet?: string;
    suburb?: string;
    neighbourhood?: string;
    village?: string;
    town?: string;
    city?: string;
    county?: string;
    state?: string;
  };
}

const VEHICLE_TYPES = [
  { id: 'TAXI', label: 'Taxi', labelMg: 'Taxi', icon: Car, color: '#f59e0b', bgClass: 'bg-amber-500', textClass: 'text-amber-500', svg: 'taxi' },
  { id: 'BAJAJ', label: 'Bajaj', labelMg: 'Bajaj', icon: Bike, color: '#10b981', bgClass: 'bg-emerald-500', textClass: 'text-emerald-500', svg: 'bajaj' },
  { id: 'CAMION', label: 'Camion', labelMg: 'Kamiao', icon: Truck, color: '#3b82f6', bgClass: 'bg-blue-500', textClass: 'text-blue-500', svg: 'truck' },
  { id: '4X4', label: '4x4', labelMg: '4x4', icon: Gauge, color: '#8b5cf6', bgClass: 'bg-violet-500', textClass: 'text-violet-500', svg: '4x4' },
];

async function searchPlaces(query: string): Promise<NominatimResult[]> {
  if (!query || query.length < 2) return [];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=mg&limit=8&addressdetails=1`,
      { headers: { 'Accept-Language': 'fr' } }
    );
    return await res.json();
  } catch (error) {
    console.error('Geocoding error:', error);
    return [];
  }
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
      headers: { 'Accept-Language': 'fr' }
    });
    const data = await res.json();
    if (data.address) {
      const parts = [
        data.address.road || data.address.hamlet || data.address.suburb || data.address.neighbourhood,
        data.address.city || data.address.town || data.address.village
      ].filter(Boolean);
      return parts.join(', ') || data.display_name?.split(',').slice(0, 2).join(',') || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

function useCreateBooking() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { lang } = useTranslation();

  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiFetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to create booking');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      toast({
        title: lang === 'mg' ? "Reservation natao!" : "Réservation créée!",
        description: lang === 'mg'
          ? `Reservation ho amin'ny ${new Date(data.scheduledFor).toLocaleDateString()}`
          : `Réservation pour le ${new Date(data.scheduledFor).toLocaleDateString()}`,
        className: "mobile-toast"
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: lang === 'mg' ? "Tsy nety" : "Erreur",
        description: error.message,
        className: "mobile-toast"
      });
    },
  });
}

interface CustomPlace {
  id: number;
  name: string;
  nameFr: string;
  lat: string;
  lng: string;
}

async function searchPlacesWithCustom(query: string): Promise<NominatimResult[]> {
  if (!query || query.length < 2) return [];
  
  try {
    const res = await fetch('/api/places', { credentials: 'include' });
    if (!res.ok) return [];
    
    const customPlaces: CustomPlace[] = await res.json();
    const qLower = query.toLowerCase();
    const matched = customPlaces.filter(place => 
      place.name.toLowerCase().includes(qLower) || 
      place.nameFr.toLowerCase().includes(qLower)
    );
    
    const results: NominatimResult[] = matched.map(place => ({
      place_id: place.id,
      display_name: `${place.name} (${place.nameFr})`,
      lat: place.lat,
      lon: place.lng,
      type: 'custom',
      class: 'place',
      address: { city: place.name, state: place.nameFr }
    }));
    
    return results;
  } catch (error) {
    console.error('Erreur lors de la recherche de lieux personnalisés :', error);
    return [];
  }
}

export default function PassengerHome() {
  const [, setLocation] = useLocation();
  const { t, lang } = useTranslation();
  const createRide = useCreateRide();
  const createBooking = useCreateBooking();
  const { toast } = useToast();
  const { user } = useAuth();

  // --- Gestion de la localisation obligatoire pour le passager ---
  const [passengerLocation, setPassengerLocation] = useState<LatLng | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [gpsDenied, setGpsDenied] = useState(false);

  const requestPassengerLocation = useCallback(async (): Promise<boolean> => {
    if (!navigator.geolocation) {
      setLocationError(lang === 'mg' ? "Tsy manohana GPS ity navigateur ity" : "Ce navigateur ne supporte pas la géolocalisation");
      setGpsDenied(true);
      return false;
    }
  
    setIsLocating(true);
    setLocationError(null);
  
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setPassengerLocation(loc);
          setLocationError(null);
          setGpsDenied(false);
          setIsLocating(false);
          toast({
            title: lang === 'mg' ? "Toerana hita" : "Position trouvée",
            description: lang === 'mg' ? `Précision: ${Math.round(pos.coords.accuracy)}m` : `Précision: ${Math.round(pos.coords.accuracy)}m`,
            className: "mobile-toast"
          });
          resolve(true);
        },
        (error) => {
          console.error('GPS error:', error);
          setIsLocating(false);
          let message = '';
          let showRetryButton = true;
          
          if (error.code === error.PERMISSION_DENIED) {
            message = lang === 'mg' 
              ? "Navela ny GPS, ilaina ny mamela azy. Tsindrio ny bokotra 'Réessayer' raha vao manome alalana ianao."
              : "Permission GPS refusée. Veuillez autoriser la localisation dans les paramètres de votre appareil, puis appuyez sur 'Réessayer'.";
            setGpsDenied(true);
            showRetryButton = true;
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            message = lang === 'mg' ? "Tsy hita ny toerana" : "Position indisponible";
            showRetryButton = false;
          } else if (error.code === error.TIMEOUT) {
            message = lang === 'mg' ? "Lany daty ny GPS" : "Délai dépassé";
            showRetryButton = true;
          } else {
            message = error.message;
            showRetryButton = true;
          }
          
          setLocationError(message);
          toast({
            variant: "destructive",
            title: lang === 'mg' ? "Tsy hita ny toerana" : "Position non trouvée",
            description: message,
            className: "mobile-toast",
            duration: showRetryButton ? 8000 : 4000,
          });
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }, [lang, toast]);
  
  useEffect(() => {
    requestPassengerLocation();
  }, [requestPassengerLocation]);

  const useMyLocationAsPickup = useCallback(async () => {
    if (!passengerLocation) {
      const ok = await requestPassengerLocation();
      if (!ok) return;
    }
    if (passengerLocation) {
      setIsLocating(true);
      const address = await reverseGeocode(passengerLocation.lat, passengerLocation.lng);
      setIsLocating(false);
      setPickup(address);
      setPickupCoords(passengerLocation);
      setMapCenter(passengerLocation);
      setFlyTrigger(prev => prev + 1);
      toast({
        title: lang === 'mg' ? "Toerana fiaingana" : "Point de départ",
        description: address,
        className: "mobile-toast"
      });
    }
  }, [passengerLocation, requestPassengerLocation, lang, toast]);

  // Correction des notifications sur mobile
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

  const [pickup, setPickup] = useState('');
  const [pickupCoords, setPickupCoords] = useState<LatLng | null>(null);
  const [dropoff, setDropoff] = useState('');
  const [dropoffCoords, setDropoffCoords] = useState<LatLng | null>(null);
  const [vehicle, setVehicle] = useState<'TAXI' | 'BAJAJ' | 'CAMION' | '4X4'>('TAXI');
  const [selectMode, setSelectMode] = useState<'pickup' | 'dropoff' | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [mapCenter, setMapCenter] = useState<LatLng>(GEOCENTER);
  const [flyTrigger, setFlyTrigger] = useState(0);
  const [hasActiveRide, setHasActiveRide] = useState(false);

  const [pickupSuggestions, setPickupSuggestions] = useState<NominatimResult[]>([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState<NominatimResult[]>([]);
  const [isSearchingPickup, setIsSearchingPickup] = useState(false);
  const [isSearchingDropoff, setIsSearchingDropoff] = useState(false);
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);
  const [showDropoffSuggestions, setShowDropoffSuggestions] = useState(false);
  const [pickupNoResults, setPickupNoResults] = useState(false);
  const [dropoffNoResults, setDropoffNoResults] = useState(false);

  const pickupDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropoffDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [bookingNote, setBookingNote] = useState('');

  const [routeCoords, setRouteCoords] = useState<[number, number][] | undefined>(undefined);
  const [osrmDistance, setOsrmDistance] = useState<number | null>(null);
  const [osrmDuration, setOsrmDuration] = useState<number | null>(null);

  const [showTopAd, setShowTopAd] = useState(true);
  const { connected, subscribe } = useWebSocket();
  const queryClient = useQueryClient();
  const [showFullscreenAd, setShowFullscreenAd] = useState(true);

  const [unreadBookingOffers, setUnreadBookingOffers] = useState(0);

  const { data: activeRide } = useQuery({
    queryKey: ['/api/rides/active'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/rides/active', { credentials: 'include' });
        if (res.status === 404) return null;
        if (!res.ok) return null;
        return res.json();
      } catch {
        return null;
      }
    },
    refetchInterval: 15000,
  });

  useEffect(() => {
    setHasActiveRide(!!(activeRide && activeRide.status !== 'COMPLETED' && activeRide.status !== 'CANCELED'));
  }, [activeRide]);

  useEffect(() => {
    const unloadHandler = () => {
      if (window.location.pathname === '/passenger/bookings') {
        setUnreadBookingOffers(0);
      }
    };
    window.addEventListener('popstate', unloadHandler);
    return () => window.removeEventListener('popstate', unloadHandler);
  }, []);

  useEffect(() => {
    if (!connected) return;
    const unsub = subscribe('BOOKING_NEW_OFFER', (data) => {
      console.log('📩 Nouvelle offre reçue côté passager:', data);
      setUnreadBookingOffers(prev => prev + 1);
      toast({
        title: lang === 'mg' ? "Tolobidy vaovao" : "Nouvelle offre",
        description: lang === 'mg' ? `Tolobidy ho an'ny reservation #${data.bookingId}` : `Offre pour la réservation #${data.bookingId}`,
        className: "mobile-toast",
        duration: 5000,
      });
    });
    return () => unsub();
  }, [connected, subscribe, lang, toast]);

  useEffect(() => {
    if (!connected) return;
    const unsubscribe = subscribe('OFFER_ACCEPTED', (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/rides/active'] });
      toast({
        title: lang === 'mg' ? "Tolobidy voaray!" : "Offre acceptée!",
        description: lang === 'mg' ? `Ny mpamily ${data.driverName} dia ho tonga` : `Le chauffeur ${data.driverName} va arriver`,
        className: "mobile-toast"
      });
    });
    return () => unsubscribe();
  }, [connected, queryClient, toast, lang]);

  useEffect(() => {
    if (pickupCoords && dropoffCoords) {
      fetchOSRMRoute(pickupCoords, dropoffCoords).then(result => {
        if (result) {
          setRouteCoords(result.coordinates);
          setOsrmDistance(result.distanceKm);
          setOsrmDuration(result.durationMin);
        } else {
          setRouteCoords(undefined);
          setOsrmDistance(null);
          setOsrmDuration(null);
        }
      });
    } else {
      setRouteCoords(undefined);
      setOsrmDistance(null);
      setOsrmDuration(null);
    }
  }, [pickupCoords, dropoffCoords]);

  const handlePickupInput = useCallback((value: string) => {
    setPickup(value);
    setPickupCoords(null);
    setPickupNoResults(false);
    if (pickupDebounceRef.current) clearTimeout(pickupDebounceRef.current);
    if (value.length < 2) {
      setPickupSuggestions([]);
      setShowPickupSuggestions(false);
      return;
    }
    setIsSearchingPickup(true);
    setShowPickupSuggestions(true);
    pickupDebounceRef.current = setTimeout(async () => {
      try {
        const results = await searchPlacesWithCustom(value);
        setPickupSuggestions(results);
        setPickupNoResults(results.length === 0);
      } catch (error) {
        setPickupSuggestions([]);
      } finally {
        setIsSearchingPickup(false);
      }
    }, 400);
  }, []);

  const handleDropoffInput = useCallback((value: string) => {
    setDropoff(value);
    setDropoffCoords(null);
    setDropoffNoResults(false);
    if (dropoffDebounceRef.current) clearTimeout(dropoffDebounceRef.current);
    if (value.length < 2) {
      setDropoffSuggestions([]);
      setShowDropoffSuggestions(false);
      return;
    }
    setIsSearchingDropoff(true);
    setShowDropoffSuggestions(true);
    dropoffDebounceRef.current = setTimeout(async () => {
      try {
        const results = await searchPlacesWithCustom(value);
        setDropoffSuggestions(results);
        setDropoffNoResults(results.length === 0);
      } catch (error) {
        setDropoffSuggestions([]);
      } finally {
        setIsSearchingDropoff(false);
      }
    }, 400);
  }, []);

  const selectPickupSuggestion = useCallback((result: NominatimResult) => {
    const loc = { lat: parseFloat(result.lat), lng: parseFloat(result.lon) };
    const address = result.display_name.split(',').slice(0, 2).join(',');
    setPickup(address);
    setPickupCoords(loc);
    setShowPickupSuggestions(false);
    setPickupSuggestions([]);
    setMapCenter(loc);
    setFlyTrigger(prev => prev + 1);
  }, []);

  const selectDropoffSuggestion = useCallback((result: NominatimResult) => {
    const loc = { lat: parseFloat(result.lat), lng: parseFloat(result.lon) };
    const address = result.display_name.split(',').slice(0, 2).join(',');
    setDropoff(address);
    setDropoffCoords(loc);
    setShowDropoffSuggestions(false);
    setDropoffSuggestions([]);
    setMapCenter(loc);
    setFlyTrigger(prev => prev + 1);
  }, []);

  const handlePickupNotFound = useCallback(() => {
    setShowPickupSuggestions(false);
    setSelectMode('pickup');
    if (pickup && pickup.length > 2) {
      saveUnknownSearch(pickup, 'pickup');
      toast({
        title: lang === 'mg' ? "Toerana tsy hita" : "Lieu non trouvé",
        description: lang === 'mg'
          ? "Tsindrio eo amin'ny sarintany mba hifidianana toerana. Ny fitadiavana dia ho ampahafantarina ny administrateur."
          : "Cliquez sur la carte pour sélectionner un lieu. La recherche sera notifiée à l'administrateur.",
        className: "mobile-toast"
      });
    }
  }, [pickup, lang, toast]);

  const handleDropoffNotFound = useCallback(() => {
    setShowDropoffSuggestions(false);
    setSelectMode('dropoff');
    if (dropoff && dropoff.length > 2) {
      saveUnknownSearch(dropoff, 'dropoff');
      toast({
        title: lang === 'mg' ? "Toerana tsy hita" : "Lieu non trouvé",
        description: lang === 'mg'
          ? "Tsindrio eo amin'ny sarintany mba hifidianana toerana. Ny fitadiavana dia ho ampahafantarina ny administrateur."
          : "Cliquez sur la carte pour sélectionner un lieu. La recherche sera notifiée à l'administrateur.",
        className: "mobile-toast"
      });
    }
  }, [dropoff, lang, toast]);

  const handleMapSelect = useCallback(async (loc: LatLng) => {
    setIsGeocoding(true);
    try {
      const address = await reverseGeocode(loc.lat, loc.lng);
      if (selectMode === 'pickup') {
        setPickupCoords(loc);
        setPickup(address);
        setSelectMode('dropoff');
        toast({ title: lang === 'mg' ? "Toerana voafidy" : "Lieu sélectionné", description: address, className: "mobile-toast" });
      } else if (selectMode === 'dropoff') {
        setDropoffCoords(loc);
        setDropoff(address);
        setSelectMode(null);
        toast({ title: lang === 'mg' ? "Toerana voafidy" : "Lieu sélectionné", description: address, className: "mobile-toast" });
      }
    } catch (error) {
      toast({ variant: "destructive", title: lang === 'mg' ? "Tsy nety" : "Erreur", description: lang === 'mg' ? "Tsy hita ny adiresy" : "Adresse non trouvée", className: "mobile-toast" });
    } finally {
      setIsGeocoding(false);
    }
  }, [selectMode, lang, toast]);

  const clearSelection = (type: 'pickup' | 'dropoff') => {
    if (type === 'pickup') {
      setPickup('');
      setPickupCoords(null);
      setPickupSuggestions([]);
      setShowPickupSuggestions(false);
    } else {
      setDropoff('');
      setDropoffCoords(null);
      setDropoffSuggestions([]);
      setShowDropoffSuggestions(false);
    }
  };

  const handleRequest = async () => {
    if (!pickup || !dropoff || !pickupCoords || !dropoffCoords) {
      toast({ variant: "destructive", title: lang === 'mg' ? "Tsy ampy ny mombamomba" : "Informations manquantes", description: lang === 'mg' ? "Safidio ny fiaingana sy ny fahatongavana" : "Choisissez le départ et l'arrivée", className: "mobile-toast" });
      return;
    }
    const ride = await createRide.mutateAsync({
      pickupLat: pickupCoords.lat, pickupLng: pickupCoords.lng, pickupAddress: pickup,
      dropLat: dropoffCoords.lat, dropLng: dropoffCoords.lng, dropAddress: dropoff,
      vehicleType: vehicle, distanceKm: osrmDistance ?? undefined, etaMinutes: osrmDuration ?? undefined,
    });
    if (ride) setLocation(`/passenger/ride/${ride.id}`);
  };

  const handleBooking = async () => {
    if (!pickup || !dropoff || !pickupCoords || !dropoffCoords) {
      toast({ variant: "destructive", title: lang === 'mg' ? "Tsy ampy ny mombamomba" : "Informations manquantes", className: "mobile-toast" });
      return;
    }
    if (!bookingDate || !bookingTime) {
      toast({ variant: "destructive", title: lang === 'mg' ? "Datim-potoana tsy voafidy" : "Date/heure non sélectionnée", className: "mobile-toast" });
      return;
    }
    const scheduledDateTime = new Date(`${bookingDate}T${bookingTime}`);
    if (scheduledDateTime <= new Date()) {
      toast({ variant: "destructive", title: lang === 'mg' ? "Datim-potoana tsy azo" : "Date/heure invalide", description: lang === 'mg' ? "Tsy maintsy amin'ny ho avy ny fotoana" : "La date doit être dans le futur", className: "mobile-toast" });
      return;
    }
    await createBooking.mutateAsync({
      pickupLat: pickupCoords.lat, pickupLng: pickupCoords.lng, pickupAddress: pickup,
      dropLat: dropoffCoords.lat, dropLng: dropoffCoords.lng, dropAddress: dropoff,
      vehicleType: vehicle, scheduledFor: scheduledDateTime.toISOString(), note: bookingNote || undefined,
      distanceKm: osrmDistance ?? undefined, etaMinutes: osrmDuration ?? undefined,
      estimatedPriceAr: osrmDistance ? Math.round(osrmDistance * 1500) : undefined,
    });
    setShowBookingModal(false);
    setBookingDate('');
    setBookingTime('');
    setBookingNote('');
  };

  if (hasActiveRide) {
    return (
      <MobileLayout role="passenger">
        <div className="flex h-screen items-center justify-center"><LoadingAnimation /></div>
      </MobileLayout>
    );
  }

  // Affichage d'un écran de blocage si le GPS est refusé
  if (gpsDenied) {
    return (
      <MobileLayout role="passenger">
        <div className="flex flex-col items-center justify-center h-screen p-6 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-xl font-bold mb-2">{lang === 'mg' ? 'GPS tsy azo' : 'Localisation requise'}</h2>
          <p className="text-muted-foreground mb-6">
            {lang === 'mg'
              ? 'Ity fampiharana ity dia mila ny toerana misy anao mba hahitana mpamily akaiky sy hanomezanao traikefa tsara.'
              : 'Cette application a besoin de votre position pour trouver des chauffeurs à proximité et vous offrir la meilleure expérience.'}
          </p>
          <Button onClick={() => { setGpsDenied(false); requestPassengerLocation(); }} className="rounded-xl">
            {lang === 'mg' ? 'Andramo indray' : 'Réessayer'}
          </Button>
        </div>
      </MobileLayout>
    );
  }

  const distanceKm = osrmDistance;
  const etaMin = osrmDuration;

  return (
    <>
      {showFullscreenAd && (
        <FullscreenAd 
          onClose={() => setShowFullscreenAd(false)} 
          delay={1000}
        />
      )}
      <MobileLayout role="passenger">
        {/* Indicateur de connexion WebSocket */}
        <div className="absolute top-14 left-4 z-20">
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${connected ? 'bg-emerald-500/20 text-emerald-700' : 'bg-red-500/20 text-red-700'}`}>
            {connected ? (lang === 'mg' ? 'Mifandray' : 'Connecté') : (lang === 'mg' ? 'Tsy mifandray' : 'Déconnecté')}
          </div>
        </div>

        {/* Indicateur de localisation du passager */}
        {passengerLocation && (
          <div className="absolute top-14 right-4 z-20">
            <div className="px-2 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-700 flex items-center gap-1">
              <LocateFixed className="w-3 h-3" />
              {lang === 'mg' ? 'Toerana hita' : 'Localisé'}
            </div>
          </div>
        )}

        {showTopAd && (
          <div className="absolute top-24 left-0 right-0 z-20 px-3 pointer-events-none">
            <div className="pointer-events-auto"><AdBanner position="HOME_TOP" onClose={() => setShowTopAd(false)} /></div>
          </div>
        )}

        <div className="absolute inset-0 z-0 pt-14">
          <MapView center={mapCenter} zoom={15} interactive={true} selectMode={selectMode}
            pickupMarker={pickupCoords} dropoffMarker={dropoffCoords} onLocationSelect={handleMapSelect}
            flyToTrigger={flyTrigger} showRoute={!!(pickupCoords && dropoffCoords)} routeCoordinates={routeCoords} pickupVehicleType={vehicle} />
        </div>

        {isGeocoding && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 bg-background/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg text-sm font-medium flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span>{lang === 'mg' ? 'Mitady adiresy...' : 'Recherche d\'adresse...'}</span>
          </div>
        )}

        {selectMode && (
          <div className="absolute top-20 right-4 z-20">
            <Button variant="secondary" size="sm" className="rounded-full shadow-lg bg-red-500 text-white hover:bg-red-600" onClick={() => setSelectMode(null)}>
              <X className="w-4 h-4 mr-1" />{lang === 'mg' ? 'Ajanony' : 'Annuler'}
            </Button>
          </div>
        )}

        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="absolute bottom-0 w-full z-10 p-3 max-h-[80vh] overflow-y-auto">
          <Card className="p-4 rounded-3xl shadow-xl border-0 bg-background/95 backdrop-blur-xl">
            <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-4" />
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-4">
              <h2 className="text-lg font-bold font-display text-primary">{lang === 'mg' ? 'Aiza no halehanao?' : 'Où allez-vous?'}</h2>
              <p className="text-xs text-muted-foreground">{lang === 'mg' ? 'Safidio ny toerana fiaingana sy fahatongavana' : 'Choisissez votre départ et destination'}</p>
            </motion.div>
            <div className="space-y-3 mb-4">
              <div className="relative">
                <div className="relative flex items-center">
                  <div className="absolute left-3 w-3 h-3 rounded-full bg-emerald-500 z-10 border-2 border-white shadow" />
                  <Input value={pickup} onChange={(e) => handlePickupInput(e.target.value)} onFocus={() => { if (pickupSuggestions.length > 0) setShowPickupSuggestions(true); }} onBlur={() => setTimeout(() => setShowPickupSuggestions(false), 200)} placeholder={lang === 'mg' ? 'Aiza ny fiaingana?' : 'Point de départ'} className="pl-10 pr-20 h-12 bg-secondary/50 border-none rounded-xl text-sm font-medium" />
                  <div className="absolute right-2 flex items-center gap-1">
                    {isSearchingPickup && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />}
                    {pickup && <button onClick={() => clearSelection('pickup')} className="p-1.5 hover:bg-muted rounded-full transition-colors"><X className="w-4 h-4 text-muted-foreground" /></button>}
                    <button onClick={useMyLocationAsPickup} className="p-1.5 hover:bg-muted rounded-full transition-colors" title={lang === 'mg' ? 'Toeranako' : 'Ma position'}><LocateFixed className="w-4 h-4 text-primary" /></button>
                    <button onClick={() => setSelectMode('pickup')} className="p-1.5 hover:bg-muted rounded-full transition-colors"><Crosshair className={`w-4 h-4 ${selectMode === 'pickup' ? 'text-emerald-500 animate-pulse' : 'text-muted-foreground'}`} /></button>
                  </div>
                </div>
                <AnimatePresence>
                  {showPickupSuggestions && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute left-0 right-0 top-full mt-1 z-50 bg-background border rounded-xl shadow-lg overflow-hidden max-h-60 overflow-y-auto">
                      {pickupSuggestions.map((result) => (
                        <button key={result.place_id} onMouseDown={(e) => e.preventDefault()} onClick={() => selectPickupSuggestion(result)} className="w-full text-left px-3 py-3 text-sm hover:bg-muted/50 flex items-start gap-3 border-b last:border-b-0 transition-colors">
                          <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" />
                          <div className="min-w-0 flex-1">
                            <span className="font-medium line-clamp-1 block">{result.display_name.split(',').slice(0, 2).join(',')}</span>
                            <span className="text-xs text-muted-foreground line-clamp-1 block">{result.display_name}</span>
                          </div>
                        </button>
                      ))}
                      {pickupNoResults && (
                        <button onMouseDown={(e) => e.preventDefault()} onClick={handlePickupNotFound} className="w-full text-left px-3 py-3 text-sm bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100 dark:hover:bg-amber-950/40 flex items-center gap-3 transition-colors">
                          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                          <div><span className="font-medium text-amber-700 dark:text-amber-400">{lang === 'mg' ? 'Tsy hita ny toerana' : 'Lieu non trouvé'}</span><span className="text-xs text-amber-600 dark:text-amber-500 block">{lang === 'mg' ? 'Tsindrio eto mba hifidianana toerana amin\'ny sarintany' : 'Cliquez ici pour sélectionner un lieu sur la carte'}</span></div>
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="relative">
                <div className="relative flex items-center">
                  <div className="absolute left-3 w-3 h-3 rounded-sm bg-red-500 z-10 border-2 border-white shadow" />
                  <Input value={dropoff} onChange={(e) => handleDropoffInput(e.target.value)} onFocus={() => { if (dropoffSuggestions.length > 0) setShowDropoffSuggestions(true); }} onBlur={() => setTimeout(() => setShowDropoffSuggestions(false), 200)} placeholder={lang === 'mg' ? 'Aiza ny fahatongavana?' : 'Destination'} className="pl-10 pr-16 h-12 bg-secondary/50 border-none rounded-xl text-sm font-medium" />
                  <div className="absolute right-2 flex items-center gap-1">
                    {isSearchingDropoff && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />}
                    {dropoff && <button onClick={() => clearSelection('dropoff')} className="p-1.5 hover:bg-muted rounded-full transition-colors"><X className="w-4 h-4 text-muted-foreground" /></button>}
                    <button onClick={() => setSelectMode('dropoff')} className="p-1.5 hover:bg-muted rounded-full transition-colors"><Crosshair className={`w-4 h-4 ${selectMode === 'dropoff' ? 'text-red-500 animate-pulse' : 'text-muted-foreground'}`} /></button>
                  </div>
                </div>
                <AnimatePresence>
                  {showDropoffSuggestions && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute left-0 right-0 top-full mt-1 z-50 bg-background border rounded-xl shadow-lg overflow-hidden max-h-60 overflow-y-auto">
                      {dropoffSuggestions.map((result) => (
                        <button key={result.place_id} onMouseDown={(e) => e.preventDefault()} onClick={() => selectDropoffSuggestion(result)} className="w-full text-left px-3 py-3 text-sm hover:bg-muted/50 flex items-start gap-3 border-b last:border-b-0 transition-colors">
                          <Navigation className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
                          <div className="min-w-0 flex-1"><span className="font-medium line-clamp-1 block">{result.display_name.split(',').slice(0, 2).join(',')}</span><span className="text-xs text-muted-foreground line-clamp-1 block">{result.display_name}</span></div>
                        </button>
                      ))}
                      {dropoffNoResults && (
                        <button onMouseDown={(e) => e.preventDefault()} onClick={handleDropoffNotFound} className="w-full text-left px-3 py-3 text-sm bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100 dark:hover:bg-amber-950/40 flex items-center gap-3 transition-colors">
                          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                          <div><span className="font-medium text-amber-700 dark:text-amber-400">{lang === 'mg' ? 'Tsy hita ny toerana' : 'Lieu non trouvé'}</span><span className="text-xs text-amber-600 dark:text-amber-500 block">{lang === 'mg' ? 'Tsindrio eto mba hifidianana toerana amin\'ny sarintany' : 'Cliquez ici pour sélectionner un lieu sur la carte'}</span></div>
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            {distanceKm !== null && etaMin !== null && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-3 mb-4 px-1">
                <div className="flex items-center gap-1.5 text-xs bg-primary/10 px-3 py-1.5 rounded-full"><Route className="w-3.5 h-3.5 text-primary" /><span className="font-semibold">{distanceKm.toFixed(1)} km</span></div>
                <div className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                <div className="flex items-center gap-1.5 text-xs bg-primary/10 px-3 py-1.5 rounded-full"><Clock className="w-3.5 h-3.5 text-primary" /><span className="font-semibold">~{etaMin} min</span></div>
              </motion.div>
            )}
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><Car className="w-3 h-3" />{lang === 'mg' ? 'Safidio ny karazana fiara' : 'Choisissez votre véhicule'}</p>
              <div className="grid grid-cols-4 gap-2">
                {VEHICLE_TYPES.map(vt => (
                  <motion.button
                    key={vt.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setVehicle(vt.id as any)}
                    className={`py-2 flex flex-col items-center justify-center rounded-xl transition-all ${vehicle === vt.id ? `${vt.bgClass} text-white shadow-lg` : 'bg-secondary text-foreground hover:bg-secondary/70'}`}
                  >
                    <vt.icon className={`w-5 h-5 mb-1 ${vehicle === vt.id ? 'text-white' : vt.textClass}`} />
                    <span className={`font-bold text-[10px] ${vehicle === vt.id ? 'text-white' : 'text-foreground'}`}>{lang === 'mg' ? vt.labelMg : vt.label}</span>
                  </motion.button>
                ))}
              </div>
            </div>
            <div className="flex justify-center mb-3 gap-3">
              <Button variant="outline" className="rounded-xl border-dashed border-primary/50 text-primary hover:bg-primary/10 h-9 px-6" onClick={() => setShowBookingModal(true)}>
                <Calendar className="w-4 h-4 mr-2" />{lang === 'mg' ? 'Famandriana' : 'Réserver'}
              </Button>
              {(vehicle !== 'CAMION' && vehicle !== '4X4') && (
                <Button onClick={handleRequest} disabled={!pickup || !dropoff || !pickupCoords || !dropoffCoords || createRide.isPending} className="w-auto min-w-[140px] h-10 rounded-xl text-sm font-bold shadow-lg shadow-primary/30 bg-gradient-to-r from-primary to-primary/80">
                  {createRide.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('finding_drivers')}</> : t('request_ride')}
                </Button>
              )}
            </div>
          </Card>
        </motion.div>

        <Dialog open={showBookingModal} onOpenChange={setShowBookingModal}>
          <DialogContent className="rounded-3xl max-w-sm mx-auto">
            <DialogHeader><DialogTitle className="font-display text-xl flex items-center gap-2"><Calendar className="w-5 h-5 text-primary" />{lang === 'mg' ? 'Famandriana fotoana' : 'Réserver un trajet'}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2"><label className="text-sm font-semibold flex items-center gap-2"><MapPin className="w-4 h-4 text-emerald-500" />{lang === 'mg' ? 'Fiaingana' : 'Départ'}</label><p className="text-sm bg-muted/30 p-2 rounded-xl">{pickup || (lang === 'mg' ? 'Tsy voafidy' : 'Non sélectionné')}</p></div>
              <div className="space-y-2"><label className="text-sm font-semibold flex items-center gap-2"><Navigation className="w-4 h-4 text-red-500" />{lang === 'mg' ? 'Fahatongavana' : 'Arrivée'}</label><p className="text-sm bg-muted/30 p-2 rounded-xl">{dropoff || (lang === 'mg' ? 'Tsy voafidy' : 'Non sélectionné')}</p></div>
              <div className="space-y-2"><label className="text-sm font-semibold flex items-center gap-2"><Car className="w-4 h-4 text-primary" />{lang === 'mg' ? 'Karazana fiara' : 'Type de véhicule'}</label><p className="text-sm bg-muted/30 p-2 rounded-xl">{VEHICLE_TYPES.find(v => v.id === vehicle)?.label}</p></div>
              <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><label className="text-sm font-semibold">{lang === 'mg' ? 'Daty' : 'Date'}</label><Input type="date" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="rounded-xl" /></div><div className="space-y-2"><label className="text-sm font-semibold">{lang === 'mg' ? 'Ora' : 'Heure'}</label><Input type="time" value={bookingTime} onChange={(e) => setBookingTime(e.target.value)} className="rounded-xl" /></div></div>
              <div className="space-y-2"><label className="text-sm font-semibold">{lang === 'mg' ? 'Fanampiny' : 'Note (optionnel)'}</label><Input placeholder={lang === 'mg' ? 'Fanazavana fanampiny...' : 'Informations supplémentaires...'} value={bookingNote} onChange={(e) => setBookingNote(e.target.value)} className="rounded-xl" /></div>
            </div>
            <DialogFooter>
              <div className="flex justify-center gap-2 w-full">
                <Button variant="outline" className="w-32" onClick={() => setShowBookingModal(false)}>{lang === 'mg' ? 'Hiverina' : 'Annuler'}</Button>
                <Button className="w-32 bg-gradient-to-r from-primary to-primary/80" onClick={handleBooking} disabled={!pickup || !dropoff || !bookingDate || !bookingTime || createBooking.isPending}>{createBooking.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (lang === 'mg' ? 'Hamangataka' : 'Réserver')}</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </MobileLayout>
    </>
  );
}