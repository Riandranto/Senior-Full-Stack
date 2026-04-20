// src/pages/passenger/Home.tsx
import { useState, useCallback, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import { MobileLayout } from '@/components/RoleLayout';
import { MapView, LatLng, fetchOSRMRoute } from '@/components/Map';
import { useCreateRide } from '@/hooks/use-passenger';
import { useWebSocketEvents } from '@/hooks/use-websocket-events';
import { RefreshIndicator } from '@/components/RefreshIndicator';
import { LoadingAnimation } from '@/components/LoadingAnimation';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  MapPin, Navigation, Car, Bike, Crosshair, X, Loader2, LocateFixed, 
  Route, Calendar, Clock, Menu, Home, History, User, LogOut, 
  BookMarked, ChevronRight, Settings, Star, MessageCircle, Bell,Truck,Gauge,
  Shield, HelpCircle, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GEOCENTER, isWithinRange } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { AdBanner } from '@/components/AdBanner';
import { useWebSocket } from '@/hooks/use-websocket';
import { apiFetch } from '@/lib/api';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';

// IMPORTS MANQUANTS
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

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

// Types de véhicules disponibles
const VEHICLE_TYPES = [
  { id: 'TAXI', label: 'Taxi', labelMg: 'Taxi', icon: Car, color: 'from-blue-500 to-blue-600' },
  { id: 'BAJAJ', label: 'Bajaj', labelMg: 'Bajaj', icon: Bike, color: 'from-green-500 to-green-600' },
  { id: 'CAMION', label: 'Camion', labelMg: 'Kamiao', icon: Truck, color: 'from-orange-500 to-orange-600' },
  { id: '4X4', label: '4x4 Location', labelMg: '4x4 Location', icon: Gauge, color: 'from-red-500 to-red-600' },
];

const LOCAL_PLACES: { name: string; nameFr: string; lat: number; lng: number }[] = [
  /*{ name: 'Bazary Be', nameFr: 'Grand Marché', lat: -25.0320, lng: 46.9895 },
  { name: 'Libanona Beach', nameFr: 'Plage Libanona', lat: -25.0368, lng: 46.9970 },
  { name: 'Tanambao', nameFr: 'Tanambao', lat: -25.0290, lng: 46.9780 },
  { name: 'Ambinanikely', nameFr: 'Ambinanikely', lat: -25.0260, lng: 46.9930 },
  { name: 'Gare Routière', nameFr: 'Gare Routière', lat: -25.0305, lng: 46.9850 },
  { name: 'Hôpital Philibert Tsiranana', nameFr: 'Hôpital Philibert Tsiranana', lat: -25.0298, lng: 46.9918 },
  { name: 'Aéroport Fort-Dauphin (TLE)', nameFr: 'Aéroport Fort-Dauphin (TLE)', lat: -25.0381, lng: 46.9556 },
  { name: 'Port de Fort-Dauphin', nameFr: 'Port de Fort-Dauphin', lat: -25.0340, lng: 47.0010 },
  { name: 'Ankoba', nameFr: 'Ankoba', lat: -25.0240, lng: 46.9960 },
  { name: 'Amboanato', nameFr: 'Amboanato', lat: -25.0265, lng: 46.9840 },
  { name: 'Esokaka', nameFr: 'Esokaka', lat: -25.0390, lng: 46.9880 },
  { name: 'Manambaro', nameFr: 'Manambaro', lat: -25.0230, lng: 46.9270 },*/
  { name: 'Mahamasina', nameFr: 'Mahamasina', lat: -18.8945, lng: 47.5274 },
  { name: 'Analakely', nameFr: 'Analakely', lat: -18.9045, lng: 47.5272 },
  { name: 'Antaninarenina', nameFr: 'Antaninarenina', lat: -18.9095, lng: 47.5262 },
  { name: 'Ambohijatovo', nameFr: 'Ambohijatovo', lat: -18.9135, lng: 47.5278 },
  { name: '67 Ha', nameFr: '67 Ha', lat: -18.8900, lng: 47.5400 },
  { name: 'Andraharo', nameFr: 'Andraharo', lat: -18.8800, lng: 47.5400 },
  { name: 'Aéroport Ivato', nameFr: 'Aéroport Ivato', lat: -18.7965, lng: 47.4797 },
  { name: 'Gare Soarano', nameFr: 'Gare Soarano', lat: -18.9070, lng: 47.5260 },
  { name: 'Anosy', nameFr: 'Anosy', lat: -18.9170, lng: 47.5240 },
  { name: 'Isotry', nameFr: 'Isotry', lat: -18.8950, lng: 47.5200 },
];

function formatAddress(result: NominatimResult): string {
  if (result.address) {
    const road = result.address.road || result.address.hamlet || result.address.neighbourhood;
    const area = result.address.suburb || result.address.village || result.address.town || result.address.city;
    const parts = [road, area].filter(Boolean);
    if (parts.length > 0) return parts.join(', ');
  }
  const parts = result.display_name.split(',').map(s => s.trim());
  return parts.slice(0, 2).join(', ');
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function forwardGeocode(query: string): Promise<NominatimResult[]> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=mg&viewbox=46.8,-24.9,47.15,-25.25&bounded=1&limit=5&addressdetails=1`,
      { headers: { 'Accept-Language': 'fr' } }
    );
    let results: NominatimResult[] = await res.json();

    if (results.length === 0) {
      const res2 = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ' Fort-Dauphin')}&countrycodes=mg&limit=5&addressdetails=1`,
        { headers: { 'Accept-Language': 'fr' } }
      );
      results = await res2.json();
    }
    return results;
  } catch {
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

// Mutation pour créer une réservation
function useCreateBooking() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { lang } = useTranslation();

  return useMutation({
    mutationFn: async (data: any) => {
      console.log('📅 Creating booking with data:', data);
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
      });
    },
    onError: (error: Error) => {
      console.error('❌ Booking error:', error);
      toast({
        variant: "destructive",
        title: lang === 'mg' ? "Tsy nety" : "Erreur",
        description: error.message,
      });
    },
  });
}

// Composant Menu latéral
function SideMenu({ isOpen, onClose, user, onLogout, lang }: any) {
  const [, setLocation] = useLocation();
  
  const menuItems = [
    { icon: Home, label: lang === 'mg' ? "Fandraisana" : "Accueil", href: '/passenger', color: 'text-blue-500' },
    { icon: History, label: lang === 'mg' ? "Tantaran'ny dia" : "Historique", href: '/passenger/history', color: 'text-green-500' },
    { icon: BookMarked, label: lang === 'mg' ? "Reservation" : "Réservations", href: '/passenger/bookings', color: 'text-purple-500' },
    { icon: User, label: lang === 'mg' ? "Ny momba ahy" : "Mon profil", href: '/passenger/profile', color: 'text-amber-500' },
    { icon: Settings, label: lang === 'mg' ? "Fandrindrana" : "Paramètres", href: '/passenger/settings', color: 'text-gray-500' },
    { icon: HelpCircle, label: lang === 'mg' ? "Fanampiana" : "Aide", href: '/passenger/help', color: 'text-indigo-500' },
  ];

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="left" className="w-[280px] p-0 rounded-r-3xl overflow-y-auto">
        <div className="flex flex-col h-full">
          {/* Header avec profil */}
          <div className="bg-gradient-to-r from-primary/90 to-primary p-6 text-white">
            <div className="flex items-center gap-3 mb-4">
              <Avatar className="w-14 h-14 border-2 border-white/30 bg-white/20">
                <AvatarFallback className="bg-white/20 text-white text-lg">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-bold text-lg">{user?.name || 'Utilisateur'}</h3>
                <p className="text-xs text-white/70">{user?.phone || ''}</p>
                <Badge className="mt-1 bg-white/20 text-white border-0 text-[10px]">
                  {user?.role === 'PASSENGER' ? (lang === 'mg' ? 'Mpandeha' : 'Passager') : user?.role}
                </Badge>
              </div>
            </div>
          </div>

          {/* Menu items */}
          <div className="flex-1 py-4">
            {menuItems.map((item, idx) => (
              <motion.button
                key={item.href}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => {
                  setLocation(item.href);
                  onClose(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors group"
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${item.color} bg-muted/50 group-hover:bg-muted transition-colors`}>
                  <item.icon className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium flex-1 text-left">{item.label}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.button>
            ))}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border/30">
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium">{lang === 'mg' ? 'Fivoahana' : 'Déconnexion'}</span>
            </button>
            <div className="mt-3 text-center">
              <p className="text-[10px] text-muted-foreground">
                Farady v1.0.0
              </p>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function PassengerHome() {
  const [, setLocation] = useLocation();
  const { t, lang } = useTranslation();
  const createRide = useCreateRide();
  const createBooking = useCreateBooking();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { connected, subscribe, sendMessage } = useWebSocket();
  const { user, logout } = useAuth();
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [pickup, setPickup] = useState('');
  const [pickupCoords, setPickupCoords] = useState<LatLng | null>(null);
  const [dropoff, setDropoff] = useState('');
  const [dropoffCoords, setDropoffCoords] = useState<LatLng | null>(null);
  const [vehicle, setVehicle] = useState<'TAXI' | 'BAJAJ' | 'PICKUP' | '4X4' | 'CAMIONNETTE'>('TAXI');
  const [selectMode, setSelectMode] = useState<'pickup' | 'dropoff' | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [mapCenter, setMapCenter] = useState<LatLng>(GEOCENTER);
  const [flyTrigger, setFlyTrigger] = useState(0);
  const [hasActiveRide, setHasActiveRide] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);

  // États pour la réservation
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [bookingNote, setBookingNote] = useState('');

  // Chat states
  const [showChat, setShowChat] = useState(false);
  const [showTopAd, setShowTopAd] = useState(true);
  const [otherUserName, setOtherUserName] = useState('');
  const [otherUserId, setOtherUserId] = useState(0);
  const [activeRideId, setActiveRideId] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [pickupSuggestions, setPickupSuggestions] = useState<(NominatimResult | { isLocal: true; name: string; lat: string; lon: string; display_name: string; place_id: number })[]>([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState<(NominatimResult | { isLocal: true; name: string; lat: string; lon: string; display_name: string; place_id: number })[]>([]);
  const [isSearchingPickup, setIsSearchingPickup] = useState(false);
  const [isSearchingDropoff, setIsSearchingDropoff] = useState(false);
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);
  const [showDropoffSuggestions, setShowDropoffSuggestions] = useState(false);
  const pickupDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropoffDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: dbPlaces = [] } = useQuery<any[]>({
    queryKey: ['/api/places'],
    queryFn: async () => {
      const res = await fetch('/api/places');
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60000,
  });

  // Récupérer l'utilisateur courant
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setCurrentUser(JSON.parse(storedUser));
      } catch (e) {}
    }
  }, []);

  // Vérifier s'il y a une course active avec polling
  const { data: activeRide, refetch: refetchActiveRide, error: activeRideError } = useQuery({
    queryKey: ['/api/rides/active'],
    queryFn: async () => {
      console.log('🔄 Fetching active ride...');
      try {
        const res = await fetch('/api/rides/active', { credentials: 'include' });
        if (res.status === 404) return null;
        if (res.status === 429) {
          console.warn('Rate limited, skipping');
          return null;
        }
        if (res.status === 500) {
          console.warn('Server error fetching active ride');
          return null;
        }
        if (!res.ok) return null;
        const data = await res.json();
        console.log('📦 Active ride data:', data);
        return data;
      } catch (error) {
        console.error('Error fetching active ride:', error);
        return null;
      }
    },
    refetchInterval: 15000, // 15 secondes au lieu de 5
    refetchIntervalInBackground: false,
    staleTime: 10000,
    retry: 1,
    retryDelay: 5000,
  });

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('📱 Page visible, refetching active ride...');
        refetchActiveRide();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refetchActiveRide]);

  useEffect(() => {
    if (!connected) return;
    
    const unsubscribe = subscribe('OFFER_ACCEPTED', (data: any) => {
      console.log('🎉 OFFER_ACCEPTED received:', data);
      
      refetchActiveRide();
      queryClient.invalidateQueries({ queryKey: ['/api/rides/active'] });
      queryClient.refetchQueries({ queryKey: ['/api/rides/active'] });
      
      setOtherUserName(data.driverName || 'Chauffeur');
      setOtherUserId(data.driverId);
      setActiveRideId(data.rideId);
      setHasActiveRide(true);
      
      toast({
        title: lang === 'mg' ? "Tolobidy voaray!" : "Offre acceptée!",
        description: lang === 'mg' 
          ? `Ny mpamily ${data.driverName} dia ho tonga`
          : `Le chauffeur ${data.driverName} va arriver`,
      });
    });
    
    return () => unsubscribe();
  }, [connected, refetchActiveRide, queryClient, toast, lang]);

  useEffect(() => {
    if (activeRide && activeRide.status !== 'COMPLETED' && activeRide.status !== 'CANCELED') {
      setHasActiveRide(true);
      setActiveRideId(activeRide.id);
      
      if (activeRide.status === 'ASSIGNED' || 
          activeRide.status === 'DRIVER_EN_ROUTE' || 
          activeRide.status === 'DRIVER_ARRIVED' || 
          activeRide.status === 'IN_PROGRESS') {
        console.log('📱 Opening chat for status:', activeRide.status);
        setOtherUserName(activeRide.driver?.name || 'Chauffeur');
        setOtherUserId(activeRide.driverId);
        setShowChat(true);
      }
    } else {
      setHasActiveRide(false);
      setActiveRideId(null);
    }
  }, [activeRide, setLocation]);

  useEffect(() => {
    if (activeRide && activeRide.status !== 'PENDING' && activeRide.status !== 'BIDDING' && activeRide.status !== 'REQUESTED') {
      setOtherUserName(activeRide.driver?.name || 'Chauffeur');
      setOtherUserId(activeRide.driverId);
    }
  }, [activeRide]);

  const searchLocalPlaces = useCallback((query: string) => {
    const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const allPlaces = [
      ...LOCAL_PLACES,
      ...dbPlaces.map((p: any) => ({ name: p.name, nameFr: p.nameFr, lat: parseFloat(p.lat), lng: parseFloat(p.lng) })),
    ];
    return allPlaces.filter(p => {
      const n = p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const nf = p.nameFr.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return n.includes(q) || nf.includes(q);
    }).map((p, i) => ({
      isLocal: true as const,
      name: lang === 'fr' ? p.nameFr : p.name,
      lat: String(p.lat),
      lon: String(p.lng),
      display_name: lang === 'fr' ? p.nameFr : p.name,
      place_id: -(i + 1),
    }));
  }, [lang, dbPlaces]);

  const [pickupNoResults, setPickupNoResults] = useState(false);
  const [dropoffNoResults, setDropoffNoResults] = useState(false);
  const [routeCoords, setRouteCoords] = useState<[number, number][] | undefined>(undefined);
  const [osrmDistance, setOsrmDistance] = useState<number | null>(null);
  const [osrmDuration, setOsrmDuration] = useState<number | null>(null);

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
    const localResults = searchLocalPlaces(value);
    if (localResults.length > 0) {
      setPickupSuggestions(localResults);
      setShowPickupSuggestions(true);
    }
    if (value.length >= 3) {
      setIsSearchingPickup(true);
      setShowPickupSuggestions(true);
      pickupDebounceRef.current = setTimeout(async () => {
        const results = await forwardGeocode(value);
        const combined = [...localResults, ...results].slice(0, 6);
        setPickupSuggestions(combined);
        setIsSearchingPickup(false);
        if (combined.length === 0) setPickupNoResults(true);
      }, 400);
    }
  }, [searchLocalPlaces]);

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
    const localResults = searchLocalPlaces(value);
    if (localResults.length > 0) {
      setDropoffSuggestions(localResults);
      setShowDropoffSuggestions(true);
    }
    if (value.length >= 3) {
      setIsSearchingDropoff(true);
      setShowDropoffSuggestions(true);
      dropoffDebounceRef.current = setTimeout(async () => {
        const results = await forwardGeocode(value);
        const combined = [...localResults, ...results].slice(0, 6);
        setDropoffSuggestions(combined);
        setIsSearchingDropoff(false);
        if (combined.length === 0) setDropoffNoResults(true);
      }, 400);
    }
  }, [searchLocalPlaces]);

  const selectSuggestion = useCallback((type: 'pickup' | 'dropoff', result: any) => {
    const loc = { lat: parseFloat(result.lat), lng: parseFloat(result.lon) };
    const label = result.isLocal ? result.name : formatAddress(result);
    if (type === 'pickup') {
      setPickup(label);
      setPickupCoords(loc);
      setShowPickupSuggestions(false);
      setPickupSuggestions([]);
    } else {
      setDropoff(label);
      setDropoffCoords(loc);
      setShowDropoffSuggestions(false);
      setDropoffSuggestions([]);
    }
    setMapCenter(loc);
    setFlyTrigger(prev => prev + 1);
  }, []);

  const handleMapSelect = useCallback(async (loc: LatLng) => {
    /*if (!isWithinRange(loc.lat, loc.lng)) {
      toast({
        variant: "destructive",
        title: lang === 'mg' ? "Tsy ao anatin'ny faritra" : "Hors zone",
        description: lang === 'mg' 
          ? "Fort-Dauphin ihany no misy"
          : "Uniquement Fort-Dauphin"
      });
      return;
    }*/

    setIsGeocoding(true);
    try {
      const address = await reverseGeocode(loc.lat, loc.lng);
      
      if (selectMode === 'pickup') {
        setPickupCoords(loc);
        setPickup(address);
        setSelectMode('dropoff');
        toast({
          title: lang === 'mg' ? "Toerana voafidy" : "Lieu sélectionné",
          description: address,
        });
      } else if (selectMode === 'dropoff') {
        setDropoffCoords(loc);
        setDropoff(address);
        setSelectMode(null);
        toast({
          title: lang === 'mg' ? "Toerana voafidy" : "Lieu sélectionné",
          description: address,
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: lang === 'mg' ? "Tsy nety" : "Erreur",
        description: lang === 'mg' 
          ? "Tsy hita ny adiresy"
          : "Adresse non trouvée"
      });
    } finally {
      setIsGeocoding(false);
    }
  }, [selectMode, lang, toast]);

  const handleRequest = async () => {
    if (!pickup || !dropoff || !pickupCoords || !dropoffCoords) {
      toast({
        variant: "destructive",
        title: lang === 'mg' ? "Tsy ampy ny mombamomba" : "Informations manquantes",
        description: lang === 'mg' 
          ? "Safidio ny fiaingana sy ny fahatongavana"
          : "Choisissez le départ et l'arrivée"
      });
      return;
    }
    
    const ride = await createRide.mutateAsync({
      pickupLat: pickupCoords.lat,
      pickupLng: pickupCoords.lng,
      pickupAddress: pickup,
      dropLat: dropoffCoords.lat,
      dropLng: dropoffCoords.lng,
      dropAddress: dropoff,
      vehicleType: vehicle,
      distanceKm: osrmDistance ?? undefined,
      etaMinutes: osrmDuration ?? undefined,
    });
    
    if (ride) {
      setLocation(`/passenger/ride/${ride.id}`);
    }
  };

  const handleBooking = async () => {
    if (!pickup || !dropoff || !pickupCoords || !dropoffCoords) {
      toast({
        variant: "destructive",
        title: lang === 'mg' ? "Tsy ampy ny mombamomba" : "Informations manquantes",
        description: lang === 'mg' 
          ? "Safidio ny fiaingana sy ny fahatongavana"
          : "Choisissez le départ et l'arrivée"
      });
      return;
    }
    
    if (!bookingDate || !bookingTime) {
      toast({
        variant: "destructive",
        title: lang === 'mg' ? "Datim-potoana tsy voafidy" : "Date/heure non sélectionnée",
        description: lang === 'mg' 
          ? "Safidio ny daty sy ora handehanana"
          : "Choisissez la date et l'heure du trajet"
      });
      return;
    }
    
    const scheduledDateTime = new Date(`${bookingDate}T${bookingTime}`);
    if (scheduledDateTime <= new Date()) {
      toast({
        variant: "destructive",
        title: lang === 'mg' ? "Datim-potoana tsy azo" : "Date/heure invalide",
        description: lang === 'mg' 
          ? "Tsy maintsy amin'ny ho avy ny fotoana"
          : "La date doit être dans le futur"
      });
      return;
    }
    
    await createBooking.mutateAsync({
      pickupLat: pickupCoords.lat,
      pickupLng: pickupCoords.lng,
      pickupAddress: pickup,
      dropLat: dropoffCoords.lat,
      dropLng: dropoffCoords.lng,
      dropAddress: dropoff,
      vehicleType: vehicle,
      scheduledFor: scheduledDateTime.toISOString(),
      note: bookingNote || undefined,
      distanceKm: osrmDistance ?? undefined,
      etaMinutes: osrmDuration ?? undefined,
      estimatedPriceAr: osrmDistance ? Math.round(osrmDistance * 1500) : undefined,
    });
    
    setShowBookingModal(false);
    setBookingDate('');
    setBookingTime('');
    setBookingNote('');
  };

  const clearSelection = (type: 'pickup' | 'dropoff') => {
    if (type === 'pickup') {
      setPickup('');
      setPickupCoords(null);
    } else {
      setDropoff('');
      setDropoffCoords(null);
    }
  };

  const useMyLocation = useCallback(async () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (!isWithinRange(loc.lat, loc.lng)) {
        toast({
          variant: "destructive",
          title: lang === 'mg' ? "Tsy ao anatin'ny faritra" : "Hors zone",
        });
        return;
      }
      setIsGeocoding(true);
      const address = await reverseGeocode(loc.lat, loc.lng);
      setIsGeocoding(false);
      setPickup(address);
      setPickupCoords(loc);
      setMapCenter(loc);
      setFlyTrigger(prev => prev + 1);
    }, () => {
      toast({
        variant: "destructive",
        title: lang === 'mg' ? "Tsy afaka mahazo ny toeranao" : "Impossible de vous localiser",
      });
    }, { enableHighAccuracy: true, timeout: 10000 });
  }, [lang, toast]);

  const distanceKm = osrmDistance ?? (pickupCoords && dropoffCoords 
    ? haversineKm(pickupCoords.lat, pickupCoords.lng, dropoffCoords.lat, dropoffCoords.lng) 
    : null);
  const etaMin = osrmDuration ?? (distanceKm ? Math.max(1, Math.ceil(distanceKm / 25 * 60)) : null);

  if (hasActiveRide) {
    return (
      <MobileLayout role="passenger">
        <div className="absolute top-16 left-4 z-50">
          <div className={`px-2 py-1 rounded-full text-xs ${connected ? 'bg-green-500/20 text-green-700' : 'bg-red-500/20 text-red-700'}`}>
            {connected ? '● Connecté' : '○ Déconnecté'}
          </div>
        </div>
        <div className="flex h-screen items-center justify-center">
          <LoadingAnimation />
        </div>
      </MobileLayout>
    );
  }

  const getVehicleLabel = (vt: typeof VEHICLE_TYPES[0]) => {
    return lang === 'mg' ? vt.labelMg : vt.label;
  };

  const getVehicleDescription = (vt: typeof VEHICLE_TYPES[0]) => {
    return lang === 'mg' ? vt.descriptionMg : vt.description;
  };

  const handleLogout = async () => {
    await logout();
    setIsMenuOpen(false);
  };

  return (
    <>
      {/* Menu latéral */}
      <SideMenu 
        isOpen={isMenuOpen} 
        onClose={setIsMenuOpen} 
        user={user || currentUser}
        onLogout={handleLogout}
        lang={lang}
      />

      <MobileLayout role="passenger">
        {/* Bouton menu */}
        <button
          onClick={() => setIsMenuOpen(true)}
          className="absolute top-16 left-4 z-30 w-10 h-10 rounded-full bg-background/90 backdrop-blur-sm shadow-lg flex items-center justify-center border border-border/30"
          data-testid="menu-button"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Indicateur de connexion WebSocket */}
        <div className="absolute top-16 left-16 z-20">
          <div className={`px-2 py-1 rounded-full text-xs ${connected ? 'bg-green-500/20 text-green-700' : 'bg-red-500/20 text-red-700'}`}>
            {connected ? '● Connecté' : '○ Déconnecté'}
          </div>
        </div>

        {/* Publicité en haut */}
        {showTopAd && (
          <div className="absolute top-14 left-0 right-0 z-20 px-3 pointer-events-none">
            <div className="pointer-events-auto">
              <AdBanner 
                position="HOME_TOP" 
                onClose={() => setShowTopAd(false)}
              />
            </div>
          </div>
        )}
        
        <div className="absolute inset-0 z-0 pt-14">
          <MapView 
            center={mapCenter} 
            zoom={15}
            interactive={true} 
            selectMode={selectMode}
            pickupMarker={pickupCoords}
            dropoffMarker={dropoffCoords}
            onLocationSelect={handleMapSelect}
            flyToTrigger={flyTrigger}
            showRoute={!!(pickupCoords && dropoffCoords)}
            routeCoordinates={routeCoords}
          />
        </div>

        {isGeocoding && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 bg-background/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg text-sm font-medium flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            {lang === 'mg' ? 'Mitady adiresy...' : 'Recherche d\'adresse...'}
          </div>
        )}

        {selectMode && (
          <div className="absolute top-20 right-4 z-20">
            <Button 
              variant="secondary" 
              size="sm" 
              className="rounded-full shadow-lg"
              onClick={() => setSelectMode(null)}
              data-testid="button-cancel-select"
            >
              <X className="w-4 h-4 mr-1" />
              {lang === 'mg' ? 'Ajanony' : 'Annuler'}
            </Button>
          </div>
        )}

        <motion.div 
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="absolute bottom-0 w-full z-10 p-3 max-h-[85vh] overflow-y-auto"
        >
          <Card className="p-4 rounded-3xl shadow-float border-0 bg-background/95 backdrop-blur-xl">
            <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-4" />
            
            {/* Section titre avec animation */}
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-4"
            >
              <h2 className="text-lg font-bold font-display bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                {lang === 'mg' ? 'Aiza no halehanao?' : 'Où allez-vous?'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {lang === 'mg' ? 'Safidio ny toerana fiaingana sy fahatongavana' : 'Choisissez votre départ et destination'}
              </p>
            </motion.div>
            
            <div className="space-y-2.5 mb-4">
              <div className="relative" data-testid="pickup-field">
                <div className="relative flex items-center">
                  <div className="absolute left-3 w-3 h-3 rounded-full bg-green-500 z-10 border-2 border-white shadow" />
                  <Input 
                    value={pickup}
                    onChange={(e) => handlePickupInput(e.target.value)}
                    onFocus={() => { if (pickupSuggestions.length > 0) setShowPickupSuggestions(true); }}
                    onBlur={() => setTimeout(() => setShowPickupSuggestions(false), 200)}
                    placeholder={lang === 'mg' ? 'Aiza ny fiaingana?' : 'Point de départ'}
                    className="pl-10 pr-20 h-11 bg-secondary/50 border-none rounded-xl text-sm font-medium"
                    data-testid="input-pickup"
                  />
                  <div className="absolute right-1.5 flex items-center gap-0.5">
                    {isSearchingPickup && <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />}
                    {pickup && (
                      <button onClick={() => { clearSelection('pickup'); setShowPickupSuggestions(false); setPickupSuggestions([]); }} className="p-1.5 hover:bg-muted rounded-full" data-testid="clear-pickup">
                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    )}
                    <button onClick={useMyLocation} className="p-1.5 hover:bg-muted rounded-full" data-testid="button-my-location" title={lang === 'mg' ? 'Toeranako' : 'Ma position'}>
                      <LocateFixed className="w-3.5 h-3.5 text-blue-500" />
                    </button>
                    <button onClick={() => setSelectMode('pickup')} className="p-1.5 hover:bg-muted rounded-full" data-testid="select-pickup-map">
                      <Crosshair className={`w-3.5 h-3.5 ${selectMode === 'pickup' ? 'text-green-500 animate-pulse' : 'text-muted-foreground'}`} />
                    </button>
                  </div>
                </div>
                <AnimatePresence>
                  {showPickupSuggestions && (pickupSuggestions.length > 0 || pickupNoResults) && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute left-0 right-0 top-full mt-1 z-50 bg-background border rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto"
                      data-testid="pickup-suggestions"
                    >
                      {pickupSuggestions.map((result: any) => (
                        <button
                          key={result.place_id}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectSuggestion('pickup', result)}
                          className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted/50 flex items-start gap-2 border-b last:border-b-0 transition-colors"
                          data-testid={`pickup-suggestion-${result.place_id}`}
                        >
                          <MapPin className={`w-4 h-4 mt-0.5 shrink-0 ${result.isLocal ? 'text-primary' : 'text-green-500'}`} />
                          <div className="min-w-0">
                            <span className="font-medium line-clamp-1">{result.isLocal ? result.name : formatAddress(result)}</span>
                            {!result.isLocal && (
                              <span className="text-xs text-muted-foreground line-clamp-1 block">{result.display_name}</span>
                            )}
                          </div>
                        </button>
                      ))}
                      {pickupNoResults && (
                        <button
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { setSelectMode('pickup'); setShowPickupSuggestions(false); setPickupNoResults(false); }}
                          className="w-full text-left px-3 py-3 text-sm bg-primary/5 hover:bg-primary/10 flex items-center gap-2 transition-colors"
                          data-testid="pickup-mark-on-map"
                        >
                          <Crosshair className="w-4 h-4 text-primary shrink-0" />
                          <span className="font-medium text-primary">
                            {lang === 'mg' ? 'Tsindrio ny sarintany hifidianana' : 'Pointez sur la carte'}
                          </span>
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              <div className="relative" data-testid="dropoff-field">
                <div className="relative flex items-center">
                  <div className="absolute left-3 w-3 h-3 rounded-sm bg-red-500 z-10 border-2 border-white shadow" />
                  <Input 
                    value={dropoff}
                    onChange={(e) => handleDropoffInput(e.target.value)}
                    onFocus={() => { if (dropoffSuggestions.length > 0) setShowDropoffSuggestions(true); }}
                    onBlur={() => setTimeout(() => setShowDropoffSuggestions(false), 200)}
                    placeholder={lang === 'mg' ? 'Aiza ny fahatongavana?' : 'Destination'}
                    className="pl-10 pr-16 h-11 bg-secondary/50 border-none rounded-xl text-sm font-medium"
                    data-testid="input-dropoff"
                  />
                  <div className="absolute right-1.5 flex items-center gap-0.5">
                    {isSearchingDropoff && <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />}
                    {dropoff && (
                      <button onClick={() => { clearSelection('dropoff'); setShowDropoffSuggestions(false); setDropoffSuggestions([]); }} className="p-1.5 hover:bg-muted rounded-full" data-testid="clear-dropoff">
                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    )}
                    <button onClick={() => setSelectMode('dropoff')} className="p-1.5 hover:bg-muted rounded-full" data-testid="select-dropoff-map">
                      <Crosshair className={`w-3.5 h-3.5 ${selectMode === 'dropoff' ? 'text-red-500 animate-pulse' : 'text-muted-foreground'}`} />
                    </button>
                  </div>
                </div>
                <AnimatePresence>
                  {showDropoffSuggestions && (dropoffSuggestions.length > 0 || dropoffNoResults) && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute left-0 right-0 top-full mt-1 z-50 bg-background border rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto"
                      data-testid="dropoff-suggestions"
                    >
                      {dropoffSuggestions.map((result: any) => (
                        <button
                          key={result.place_id}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectSuggestion('dropoff', result)}
                          className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted/50 flex items-start gap-2 border-b last:border-b-0 transition-colors"
                          data-testid={`dropoff-suggestion-${result.place_id}`}
                        >
                          <MapPin className={`w-4 h-4 mt-0.5 shrink-0 ${result.isLocal ? 'text-primary' : 'text-red-500'}`} />
                          <div className="min-w-0">
                            <span className="font-medium line-clamp-1">{result.isLocal ? result.name : formatAddress(result)}</span>
                            {!result.isLocal && (
                              <span className="text-xs text-muted-foreground line-clamp-1 block">{result.display_name}</span>
                            )}
                          </div>
                        </button>
                      ))}
                      {dropoffNoResults && (
                        <button
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { setSelectMode('dropoff'); setShowDropoffSuggestions(false); setDropoffNoResults(false); }}
                          className="w-full text-left px-3 py-3 text-sm bg-primary/5 hover:bg-primary/10 flex items-center gap-2 transition-colors"
                          data-testid="dropoff-mark-on-map"
                        >
                          <Crosshair className="w-4 h-4 text-primary shrink-0" />
                          <span className="font-medium text-primary">
                            {lang === 'mg' ? 'Tsindrio ny sarintany hifidianana' : 'Pointez sur la carte'}
                          </span>
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {distanceKm !== null && etaMin !== null && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-3 mb-3 px-1"
              >
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-primary/5 px-3 py-1.5 rounded-full">
                  <Route className="w-3.5 h-3.5 text-primary" />
                  <span className="font-semibold text-foreground">{distanceKm.toFixed(1)} km</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-primary/5 px-3 py-1.5 rounded-full">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  <span className="font-semibold text-foreground">~{etaMin} min</span>
                </div>
              </motion.div>
            )}

            {/* Types de véhicules améliorés */}
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <Car className="w-3 h-3" />
                {lang === 'mg' ? 'Safidio ny karazana fiara' : 'Choisissez votre véhicule'}
              </p>
              <div className="grid grid-cols-5 gap-1.5">
                {VEHICLE_TYPES.map(vt => (
                  <motion.button 
                    key={vt.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setVehicle(vt.id as any)}
                    className={`py-2 flex flex-col items-center justify-center rounded-xl transition-all ${
                      vehicle === vt.id 
                        ? `bg-gradient-to-r ${vt.color} text-white shadow-lg` 
                        : 'bg-secondary text-foreground hover:bg-secondary/70'
                    }`}
                    data-testid={`select-${vt.id.toLowerCase()}`}
                  >
                    <vt.icon className={`w-4 h-4 mb-0.5 ${vehicle === vt.id ? 'text-white' : 'text-muted-foreground'}`} />
                    <span className={`font-bold text-[10px] ${vehicle === vt.id ? 'text-white' : 'text-foreground'}`}>
                      {getVehicleLabel(vt)}
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="flex gap-2 mb-3">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
                <Button
                  variant="outline"
                  className="w-full rounded-xl border-dashed"
                  onClick={() => setShowBookingModal(true)}
                  data-testid="button-booking"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  {lang === 'mg' ? 'Mangataka fotoana' : 'Réserver'}
                </Button>
              </motion.div>
            </div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button 
                onClick={handleRequest}
                disabled={!pickup || !dropoff || !pickupCoords || !dropoffCoords || createRide.isPending}
                className="w-full h-12 rounded-2xl text-base font-bold shadow-lg shadow-primary/20 transition-all bg-gradient-to-r from-primary to-primary/80"
                data-testid="button-request-ride"
              >
                {createRide.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('finding_drivers')}
                  </>
                ) : (
                  t('request_ride')
                )}
              </Button>
            </motion.div>
          </Card>
        </motion.div>

        {/* Modal de réservation */}
        <Dialog open={showBookingModal} onOpenChange={setShowBookingModal}>
          <DialogContent className="rounded-3xl max-w-sm mx-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-xl flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                {lang === 'mg' ? 'Mangataka fotoana' : 'Réserver un trajet'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-green-500" />
                  {lang === 'mg' ? 'Fiaingana' : 'Départ'}
                </label>
                <p className="text-sm bg-muted/30 p-2 rounded-xl">{pickup || (lang === 'mg' ? 'Tsy voafidy' : 'Non sélectionné')}</p>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-semibold flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-red-500" />
                  {lang === 'mg' ? 'Fahatongavana' : 'Arrivée'}
                </label>
                <p className="text-sm bg-muted/30 p-2 rounded-xl">{dropoff || (lang === 'mg' ? 'Tsy voafidy' : 'Non sélectionné')}</p>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-semibold flex items-center gap-2">
                  <Car className="w-4 h-4 text-primary" />
                  {lang === 'mg' ? 'Karazana fiara' : 'Type de véhicule'}
                </label>
                <p className="text-sm bg-muted/30 p-2 rounded-xl">
                  {VEHICLE_TYPES.find(v => v.id === vehicle)?.label}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">
                    {lang === 'mg' ? 'Daty' : 'Date'}
                  </label>
                  <Input
                    type="date"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="rounded-xl"
                    data-testid="input-booking-date"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">
                    {lang === 'mg' ? 'Ora' : 'Heure'}
                  </label>
                  <Input
                    type="time"
                    value={bookingTime}
                    onChange={(e) => setBookingTime(e.target.value)}
                    className="rounded-xl"
                    data-testid="input-booking-time"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-semibold">
                  {lang === 'mg' ? 'Fanampiny' : 'Note (optionnel)'}
                </label>
                <Input
                  placeholder={lang === 'mg' ? 'Fanazavana fanampiny...' : 'Informations supplémentaires...'}
                  value={bookingNote}
                  onChange={(e) => setBookingNote(e.target.value)}
                  className="rounded-xl"
                  data-testid="input-booking-note"
                />
              </div>
            </div>
            
            <DialogFooter>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowBookingModal(false)}
                >
                  {lang === 'mg' ? 'Hiverina' : 'Annuler'}
                </Button>
                <Button
                  className="flex-1 bg-primary"
                  onClick={handleBooking}
                  disabled={!pickup || !dropoff || !bookingDate || !bookingTime || createBooking.isPending}
                  data-testid="button-confirm-booking"
                >
                  {createBooking.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    lang === 'mg' ? 'Hamangataka' : 'Réserver'
                  )}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </MobileLayout>
    </>
  );
}