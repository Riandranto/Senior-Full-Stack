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
import { MapPin, Navigation, Car, Bike, Crosshair, X, Loader2, LocateFixed, Route } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GEOCENTER, isWithinRange } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AdBanner } from '@/components/AdBanner';
import { useWebSocket } from '@/hooks/use-websocket';

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

const LOCAL_PLACES: { name: string; nameFr: string; lat: number; lng: number }[] = [
  { name: 'Bazary Be', nameFr: 'Grand Marché', lat: -25.0320, lng: 46.9895 },
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
  { name: 'Manambaro', nameFr: 'Manambaro', lat: -25.0230, lng: 46.9270 },
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

export default function PassengerHome() {
  const [, setLocation] = useLocation();
  const { t, lang } = useTranslation();
  const createRide = useCreateRide();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { connected, subscribe, sendMessage } = useWebSocket();
  
  const [pickup, setPickup] = useState('');
  const [pickupCoords, setPickupCoords] = useState<LatLng | null>(null);
  const [dropoff, setDropoff] = useState('');
  const [dropoffCoords, setDropoffCoords] = useState<LatLng | null>(null);
  const [vehicle, setVehicle] = useState<'TAXI' | 'BAJAJ'>('TAXI');
  const [selectMode, setSelectMode] = useState<'pickup' | 'dropoff' | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [mapCenter, setMapCenter] = useState<LatLng>(GEOCENTER);
  const [flyTrigger, setFlyTrigger] = useState(0);
  const [hasActiveRide, setHasActiveRide] = useState(false);

  // Chat states
  const [showChat, setShowChat] = useState(false);
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
    // FIX: Use a simple number instead of a function to avoid closure issues
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    staleTime: 0,
    retry: 1,
  });

  // Ajouter un useEffect pour forcer le refetch quand la page devient visible
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

  // Écouter les événements WebSocket pour OFFER_ACCEPTED
  useEffect(() => {
    if (!connected) return;
    
    const unsubscribe = subscribe('OFFER_ACCEPTED', (data: any) => {
      console.log('🎉 OFFER_ACCEPTED received:', data);
      
      // Forcer le refetch immédiat
      refetchActiveRide();
      queryClient.invalidateQueries({ queryKey: ['/api/rides/active'] });
      queryClient.refetchQueries({ queryKey: ['/api/rides/active'] });
      
      // Ouvrir le chat immédiatement
      setOtherUserName(data.driverName || 'Chauffeur');
      setOtherUserId(data.driverId);
      setActiveRideId(data.rideId);
      setHasActiveRide(true);
      
      // Notification
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
      
      // Ouvrir le chat si la course est assignée ou en cours
      if (activeRide.status === 'ASSIGNED' || 
          activeRide.status === 'DRIVER_EN_ROUTE' || 
          activeRide.status === 'DRIVER_ARRIVED' || 
          activeRide.status === 'IN_PROGRESS') {
        console.log('📱 Opening chat for status:', activeRide.status);
        setOtherUserName(activeRide.driver?.name || 'Chauffeur');
        setOtherUserId(activeRide.driverId);
        setShowChat(true);
      }
      
      // Ne pas rediriger immédiatement, laisser l'utilisateur voir le chat
      // setLocation(`/passenger/ride/${activeRide.id}`);
    } else {
      setHasActiveRide(false);
      setActiveRideId(null);
    }
  }, [activeRide, setLocation]);

  useEffect(() => {
    if (activeRide && activeRide.status !== 'PENDING' && activeRide.status !== 'BIDDING' && activeRide.status !== 'REQUESTED') {
      // Ouvrir le chat automatiquement
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
    if (!isWithinRange(loc.lat, loc.lng)) {
      toast({
        variant: "destructive",
        title: lang === 'mg' ? "Tsy ao anatin'ny faritra" : "Hors zone",
        description: lang === 'mg' 
          ? "Fort-Dauphin ihany no misy"
          : "Uniquement Fort-Dauphin"
      });
      return;
    }

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

  // Si une course est active, afficher l'écran de chargement avec le chat
  if (hasActiveRide) {
    return (
      <MobileLayout role="passenger">
        {/* Indicateur de connexion WebSocket pour le débogage */}
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

  return (
    <MobileLayout role="passenger">
      {/* Indicateur de connexion WebSocket */}
      <div className="absolute top-16 left-4 z-20">
        <div className={`px-2 py-1 rounded-full text-xs ${connected ? 'bg-green-500/20 text-green-700' : 'bg-red-500/20 text-red-700'}`}>
          {connected ? '● Connecté' : '○ Déconnecté'}
        </div>
      </div>

      {/* Publicité en haut */}
      <div className="absolute top-14 left-0 right-0 z-20 px-3 pointer-events-none">
        <div className="pointer-events-auto">
          <AdBanner position="HOME_TOP" />
        </div>
      </div>
      
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
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Route className="w-3.5 h-3.5" />
                <span className="font-semibold text-foreground">{distanceKm.toFixed(1)} km</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-muted-foreground/40" />
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Navigation className="w-3.5 h-3.5" />
                <span className="font-semibold text-foreground">~{etaMin} min</span>
              </div>
            </motion.div>
          )}

          <div className="flex gap-2.5 mb-4">
            <button 
              onClick={() => setVehicle('TAXI')}
              className={`flex-1 py-2.5 flex flex-col items-center justify-center rounded-2xl border-2 transition-all ${vehicle === 'TAXI' ? 'border-primary bg-primary/10' : 'border-transparent bg-secondary'}`}
              data-testid="select-taxi"
            >
              <Car className={`w-6 h-6 mb-0.5 ${vehicle === 'TAXI' ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className={`font-bold text-xs ${vehicle === 'TAXI' ? 'text-foreground' : 'text-muted-foreground'}`}>{t('taxi')}</span>
            </button>
            <button 
              onClick={() => setVehicle('BAJAJ')}
              className={`flex-1 py-2.5 flex flex-col items-center justify-center rounded-2xl border-2 transition-all ${vehicle === 'BAJAJ' ? 'border-primary bg-primary/10' : 'border-transparent bg-secondary'}`}
              data-testid="select-bajaj"
            >
              <Bike className={`w-6 h-6 mb-0.5 ${vehicle === 'BAJAJ' ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className={`font-bold text-xs ${vehicle === 'BAJAJ' ? 'text-foreground' : 'text-muted-foreground'}`}>{t('bajaj')}</span>
            </button>
          </div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button 
              onClick={handleRequest}
              disabled={!pickup || !dropoff || !pickupCoords || !dropoffCoords || createRide.isPending}
              className="w-full h-12 rounded-2xl text-base font-bold shadow-lg shadow-primary/20 transition-all"
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
    </MobileLayout>
  );
}