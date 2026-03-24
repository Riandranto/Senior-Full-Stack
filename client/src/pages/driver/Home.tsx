import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { useWebSocket } from '@/hooks/use-websocket';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { 
  MapPin, Navigation, Clock, Send, CheckCircle, Route, Phone, 
  Loader2, AlertCircle, User, Bike, Car, Wifi, WifiOff,
  Play, MapPinCheck, Flag, XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

import { GEOCENTER } from '@shared/schema';

interface ActiveRide {
  id: number;
  passengerName: string;
  passengerPhone: string;
  pickupAddress: string;
  dropAddress: string;
  status: string;
  // 🔥 Le prix peut être dans différents champs
  price?: number;
  priceAr?: number;
  amount?: number;
  total?: number;
  fare?: number;
  etaMinutes: number;
  distanceKm: number;
  createdAt: string;
  pickupLat?: string | number;
  pickupLng?: string | number;
  dropLat?: string | number;
  dropLng?: string | number;
  // Propriétés additionnelles
  [key: string]: any;
}

// 🔥 Fonction de débogage pour voir la structure complète
const debugRideStructure = (ride: any) => {
  if (!ride) return;
  
  console.log('=== STRUCTURE COMPLÈTE DE LA COURSE ===');
  console.log('Toutes les propriétés:', Object.keys(ride));
  console.log('Valeurs:', ride);
  
  // Chercher le prix dans toutes les propriétés
  const possiblePriceFields = ['price', 'priceAr', 'amount', 'total', 'fare', 'cost', 'value'];
  possiblePriceFields.forEach(field => {
    if (ride[field] !== undefined) {
      console.log(`🔍 ${field}:`, ride[field], 'type:', typeof ride[field]);
    }
  });
};

  const extractPrice = (ride: any): number => {
    if (!ride) return 0;

    const possibleFields = [
      'selectedPriceAr',  // 🔥 AJOUTÉ - c'est le champ qui contient le prix
      'price',
      'priceAr',
      'price_ar',
      'amount',
      'total',
      'fare',
      'cost',
      'value',
      'offerPrice',
      'driverPrice'
    ];

    for (const key of possibleFields) {
      const val = ride[key];

      if (val !== undefined && val !== null) {
        const num = Number(val);
        if (!isNaN(num) && num > 0) {
          console.log(`✅ Prix trouvé dans ${key}: ${num}`); // Pour déboguer
          return num;
        }
      }
    }

    console.log('❌ Aucun prix trouvé dans:', Object.keys(ride));
    return 0;
  };

export default function DriverHome() {
  const { t, lang } = useTranslation();
  const [, setLocation] = useLocation();
  const { data: profile, isLoading: profileLoading } = useDriverProfile();
  const setOnline = useSetOnline();
  const { data: requests = [], isLoading: requestsLoading } = useDriverRequests();
  const sendOffer = useSendOffer();
  const updateLocation = useUpdateLocation();
  const { connected, subscribe } = useWebSocket();
  const { toast } = useToast();
  
  const { data: activeRide, refetch: refetchActiveRide } = useDriverActiveRide();
  const updateRideStatus = useUpdateRideStatus(activeRide?.id || 0);
  const extendEta = useExtendEta(activeRide?.id || 0);

  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [price, setPrice] = useState('');
  const [priceError, setPriceError] = useState<string | null>(null);
  const [autoEta, setAutoEta] = useState<number | null>(null);
  const [calculatingEta, setCalculatingEta] = useState(false);
  const [offerSentFor, setOfferSentFor] = useState<Set<number>>(new Set());
  const [driverPos, setDriverPos] = useState<LatLng | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  
  const [showRideTracking, setShowRideTracking] = useState(false);
  const [etaAdjustment, setEtaAdjustment] = useState<string>('');
  const [etaAdjustmentError, setEtaAdjustmentError] = useState<string | null>(null);
  const [timeElapsed, setTimeElapsed] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number>(0);
  const [showArrivalConfirm, setShowArrivalConfirm] = useState(false);
  const [showCompletionConfirm, setShowCompletionConfirm] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  
  const etaTimeoutRef = useRef<NodeJS.Timeout>();
  const timerIntervalRef = useRef<NodeJS.Timeout>();
  const secondsIntervalRef = useRef<NodeJS.Timeout>();

  const [routeCoords, setRouteCoords] = useState<[number, number][] | undefined>(undefined);
  const [pickupCoords, setPickupCoords] = useState<LatLng | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<LatLng | null>(null);

  // 🔥 Debug: Afficher la structure complète de activeRide quand il change
  useEffect(() => {
    if (activeRide) {
      console.log('🔥 activeRide mis à jour:', activeRide);
      console.log('🔍 Propriétés disponibles:', Object.keys(activeRide));
      console.log('💰 Recherche du prix...');
      
      const price = extractPrice(activeRide);
      console.log('💰 Prix extrait:', price);
    }
  }, [activeRide]);

  // 🔥 Prix formaté pour l'affichage
  const formattedPrice = useMemo(() => {
    const price = extractPrice(activeRide);
    return price ? price.toLocaleString('fr-FR') : "0";
  }, [activeRide]);

  // Afficher la fenêtre de suivi quand une course est active
  useEffect(() => {
    if (activeRide && ['ASSIGNED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'IN_PROGRESS'].includes(activeRide.status)) {
      setShowRideTracking(true);

      // Extraire les coordonnées de la course active
      if (activeRide.pickupLat && activeRide.pickupLng) {
        setPickupCoords({ 
          lat: parseFloat(activeRide.pickupLat as any), 
          lng: parseFloat(activeRide.pickupLng as any) 
        });
      }
      
      if (activeRide.dropLat && activeRide.dropLng) {
        setDropoffCoords({ 
          lat: parseFloat(activeRide.dropLat as any), 
          lng: parseFloat(activeRide.dropLng as any) 
        });
      }

      // Calculer l'itinéraire complet
      if (activeRide.pickupLat && activeRide.pickupLng && activeRide.dropLat && activeRide.dropLng) {
        const pickup = { 
          lat: parseFloat(activeRide.pickupLat as any), 
          lng: parseFloat(activeRide.pickupLng as any) 
        };
        const dropoff = { 
          lat: parseFloat(activeRide.dropLat as any), 
          lng: parseFloat(activeRide.dropLng as any) 
        };
        
        fetchOSRMRoute(pickup, dropoff).then(result => {
          if (result) {
            setRouteCoords(result.coordinates);
          }
        });
      }
      
      // Si le statut est ASSIGNED, on affiche mais on ne démarre pas le timer
      if (activeRide.status === 'ASSIGNED') {
        setTimeElapsed(0);
        setTimeRemaining(activeRide.etaMinutes);
        setTimeRemainingSeconds(0);
        setTimerStarted(false);
        setStartTime(null);
        
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = undefined;
        }
        if (secondsIntervalRef.current) {
          clearInterval(secondsIntervalRef.current);
          secondsIntervalRef.current = undefined;
        }
      } 
      // Si le timer a déjà été démarré ou si on est dans un statut avancé
      else if (timerStarted || ['DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'IN_PROGRESS'].includes(activeRide.status)) {
        // Si on n'a pas encore de startTime, l'initialiser
        if (!startTime && activeRide.status !== 'ASSIGNED') {
          setStartTime(Date.now());
        }
        
        // Mettre à jour le timer toutes les secondes
        if (!secondsIntervalRef.current) {
          secondsIntervalRef.current = setInterval(() => {
            if (startTime) {
              const now = Date.now();
              const elapsedSeconds = Math.floor((now - startTime) / 1000);
              const elapsedMinutes = Math.floor(elapsedSeconds / 60);
              const remainingSeconds = 59 - (elapsedSeconds % 60);
              const remainingMinutes = Math.max(0, activeRide.etaMinutes - elapsedMinutes - (remainingSeconds === 59 ? 1 : 0));
              
              setTimeElapsed(elapsedMinutes);
              setTimeRemaining(remainingMinutes);
              setTimeRemainingSeconds(remainingSeconds);
            }
          }, 1000);
        }
        
        if (timeRemaining <= 0 && timeRemainingSeconds <= 0) {
          toast({
            title: lang === 'mg' ? "Fotoana!" : "Temps écoulé!",
            description: lang === 'mg' 
              ? "Tonga ve ianao? Ampio ny toerana misy anao."
              : "Êtes-vous arrivé? Mettez à jour votre statut.",
          });
        }
      }
    } else {
      setShowRideTracking(false);
      setTimerStarted(false);
      setStartTime(null);
      setRouteCoords(undefined);
      setPickupCoords(null);
      setDropoffCoords(null);
      
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = undefined;
      }
      if (secondsIntervalRef.current) {
        clearInterval(secondsIntervalRef.current);
        secondsIntervalRef.current = undefined;
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = undefined;
      }
      if (secondsIntervalRef.current) {
        clearInterval(secondsIntervalRef.current);
        secondsIntervalRef.current = undefined;
      }
    };
  }, [activeRide, lang, timerStarted, startTime, timeRemaining, timeRemainingSeconds, toast]);

  // Marqueurs pour la carte
  const pickupMarkers = useMemo(() => {
    const markers = requests.map((r: any) => ({
      lat: parseFloat(r.pickupLat as any),
      lng: parseFloat(r.pickupLng as any),
    }));
    
    // Ajouter le marqueur de prise en charge de la course active si elle existe
    if (activeRide && ['DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'IN_PROGRESS'].includes(activeRide.status) && activeRide.pickupLat) {
      markers.push({
        lat: parseFloat(activeRide.pickupLat as any),
        lng: parseFloat(activeRide.pickupLng as any),
      });
    }
  
    return markers;
  }, [requests, activeRide]);

  // Souscription aux notifications WebSocket
  useEffect(() => {
    if (!connected || !profile?.userId) return;

    const unsubscribe = subscribe('RIDE_STATUS_CHANGED', (data: any) => {
      if (data.driverId === profile?.userId) {
        refetchActiveRide();
        
        switch(data.status) {
          case 'ASSIGNED':
            toast({
              title: lang === 'mg' ? "Dia vaovao!" : "Nouvelle course!",
              description: lang === 'mg' 
                ? "Nekena ny tolobidinao"
                : "Votre offre a été acceptée",
            });
            break;
          case 'DRIVER_EN_ROUTE':
            // Le timer démarrera via le useEffect
            break;
          case 'DRIVER_ARRIVED':
            toast({
              title: lang === 'mg' ? "Tonga!" : "Arrivé!",
              description: lang === 'mg' 
                ? "Miandrasa ny mpandeha"
                : "Attendez le passager",
            });
            break;
          case 'IN_PROGRESS':
            toast({
              title: lang === 'mg' ? "Manomboka!" : "Départ!",
              description: lang === 'mg' 
                ? "Manomboka ny dia"
                : "Course en cours",
            });
            break;
          case 'COMPLETED':
            toast({
              title: lang === 'mg' ? "Vita!" : "Terminé!",
              description: lang === 'mg' 
                ? "Vita soamantsara ny dia"
                : "Course terminée avec succès",
            });
            setShowRideTracking(false);
            setTimerStarted(false);
            setStartTime(null);
            break;
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [connected, profile?.userId, refetchActiveRide, subscribe, lang, toast]);

  // Validation de l'ajustement ETA
  const validateEtaAdjustment = useCallback((value: string): string | null => {
    if (!value) return null;
    
    const num = Number(value);
    if (isNaN(num) || num < 1) {
      return lang === 'mg' ? "1 minitra ny farany kely" : "Minimum 1 minute";
    }
    if (num > 60) {
      return lang === 'mg' ? "60 minitra ny farany be" : "Maximum 60 minutes";
    }
    return null;
  }, [lang]);

  // Gestionnaire pour "Toujours en route"
  const handleStillEnRoute = async () => {
    if (!etaAdjustment) {
      setEtaAdjustmentError(lang === 'mg' 
        ? "Ampidiro ny fotoana fanampiny" 
        : "Entrez le temps supplémentaire");
      return;
    }
    
    const error = validateEtaAdjustment(etaAdjustment);
    if (error) {
      setEtaAdjustmentError(error);
      return;
    }

    await extendEta.mutateAsync(parseInt(etaAdjustment));
    setEtaAdjustment('');
    setEtaAdjustmentError(null);
  };

  // Gestionnaire pour "Arrivé"
  const handleArrived = async () => {
    if (!activeRide) return;
    
    try {
      await updateRideStatus.mutateAsync('DRIVER_ARRIVED');
      setShowArrivalConfirm(false);
    } catch (error) {}
  };

  // Gestionnaire pour "makanesa / Commencer"
  const handleStartJourney = async () => {
    if (!activeRide) {
      console.error("No active ride");
      toast({
        variant: "destructive",
        title: lang === 'mg' ? "Tsy nety" : "Erreur",
        description: lang === 'mg' ? "Tsy hita ny dia" : "Course introuvable",
      });
      return;
    }
  
    try {
      // Afficher le chargement
      toast({
        title: lang === 'mg' ? "Fanombohana..." : "Démarrage...",
      });
  
      // Appel API
      await updateRideStatus.mutateAsync('DRIVER_EN_ROUTE');
  
      // Mise à jour UI
      setTimerStarted(true);
      setStartTime(Date.now());
      await refetchActiveRide();
  
      toast({
        title: lang === 'mg' ? "makanesa!" : "C'est parti!",
      });
    } catch (error: any) {
      console.error("ERROR in handleStartJourney:", error);
  
      // Annuler la mise à jour UI
      setTimerStarted(false);
      setStartTime(null);
  
      toast({
        variant: "destructive",
        title: lang === 'mg' ? "Tsy nety" : "Erreur",
        description: error.message || (lang === 'mg' ? "Tsy afaka nanomboka" : "Cannot start"),
      });
    }
  };

  // Gestionnaire pour "Commencer la course"
  const handleStartRide = async () => {
    if (!activeRide) return;
    
    try {
      await updateRideStatus.mutateAsync('IN_PROGRESS');
    } catch (error) {}
  };

  // Gestionnaire pour "Terminer la course"
  const handleCompleteRide = async () => {
    if (!activeRide) return;
    
    try {
      await updateRideStatus.mutateAsync('COMPLETED');
      setShowCompletionConfirm(false);
      setTimerStarted(false);
      setStartTime(null);
    } catch (error) {}
  };

  // Gestionnaire pour "Annuler la course"
  const handleCancelRide = async () => {
    if (!activeRide) return;
    
    toast({
      variant: "destructive",
      title: lang === 'mg' ? "Nofoanana" : "Annulé",
      description: lang === 'mg' 
        ? "Voafafa ny dia"
        : "Course annulée",
    });
    setShowRideTracking(false);
    setTimerStarted(false);
    setStartTime(null);
  };

  // Validation du prix
  const validatePrice = useCallback((value: string): string | null => {
    if (!value) return null;
    
    const num = Number(value);
    if (isNaN(num) || num < 1000) {
      return lang === 'mg' ? "1000 Ar ny farany ambany" : "Minimum 1000 Ar";
    }
    if (num > 1000000) {
      return lang === 'mg' ? "Lafo loatra" : "Trop élevé";
    }
    return null;
  }, [lang]);

  // Gestionnaire de changement de prix
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPrice(value);
    
    if (value) {
      const error = validatePrice(value);
      setPriceError(error);
    } else {
      setPriceError(null);
    }
  };

  // Gestionnaire d'envoi d'offre
  const handleSendOffer = async () => {
    if (!selectedRequest || !price) {
      toast({
        variant: "destructive",
        title: lang === 'mg' ? "Tsy feno" : "Incomplet",
        description: lang === 'mg' ? "Ampidiro ny vidiny" : "Entrez le prix"
      });
      return;
    }
    
    const error = validatePrice(price);
    if (error) {
      setPriceError(error);
      return;
    }

    const eta = autoEta || selectedRequest?.etaMinutes || 5;
    
    try {
      await sendOffer.mutateAsync({
        rideId: selectedRequest.id,
        priceAr: parseInt(price),
        etaMinutes: eta
      });
      
      setOfferSentFor(prev => new Set(prev).add(selectedRequest.id));
      setSelectedRequest(null);
      setPrice('');
      setPriceError(null);
      setAutoEta(null);
      setCalculatingEta(false);
      
      toast({
        title: lang === 'mg' ? 'Tolobidy nalefa!' : 'Offre envoyée !',
        description: lang === 'mg' 
          ? `Ar ${price} - ${eta} minitra`
          : `Ar ${price} - ${eta} minutes`
      });
    } catch (err: any) {
      // Erreur déjà gérée par le hook
    }
  };

  // Obtenir la position du conducteur
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError(lang === 'mg' ? "Tsy misy GPS" : "GPS non disponible");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setDriverPos(location);
        setLocationError(null);
        
        if (profile?.online) {
          updateLocation.mutate(location);
        }
      },
      (error) => {
        let message = '';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = lang === 'mg' ? "Navela ny GPS" : "GPS refusé";
            break;
          case error.POSITION_UNAVAILABLE:
            message = lang === 'mg' ? "Tsy hita ny toerana" : "Position indisponible";
            break;
          case error.TIMEOUT:
            message = lang === 'mg' ? "Lany daty ny GPS" : "GPS timeout";
            break;
        }
        setLocationError(message);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [profile?.online, lang, updateLocation]);

  // Calcul de l'ETA
  useEffect(() => {
    if (etaTimeoutRef.current) {
      clearTimeout(etaTimeoutRef.current);
    }

    if (!selectedRequest) {
      setAutoEta(null);
      setCalculatingEta(false);
      return;
    }

    const defaultEta = selectedRequest.etaMinutes || 5;
    setAutoEta(defaultEta);
    
    if (driverPos) {
      const pickupLat = parseFloat(selectedRequest.pickupLat);
      const pickupLng = parseFloat(selectedRequest.pickupLng);
      
      if (!isNaN(pickupLat) && !isNaN(pickupLng)) {
        setCalculatingEta(true);
        
        etaTimeoutRef.current = setTimeout(() => {
          fetchOSRMRoute(driverPos, { lat: pickupLat, lng: pickupLng })
            .then(result => {
              if (result && result.durationMin) {
                setAutoEta(Math.round(result.durationMin));
              }
            })
            .catch(() => {})
            .finally(() => {
              setCalculatingEta(false);
            });
        }, 500);
      }
    }

    return () => {
      if (etaTimeoutRef.current) {
        clearTimeout(etaTimeoutRef.current);
      }
    };
  }, [selectedRequest?.id, driverPos]);

  const isOnline = profile?.online || false;
  const isPending = profile?.status === 'PENDING';

  const mapCenter = useMemo(() => {
    if (activeRide) {
      return driverPos || GEOCENTER;
    }
    if (requests.length > 0 && requests[0]?.pickupLat) {
      return { 
        lat: parseFloat(requests[0].pickupLat as any), 
        lng: parseFloat(requests[0].pickupLng as any) 
      };
    }
    return driverPos || GEOCENTER;
  }, [requests, driverPos, activeRide]);

  if (profileLoading) {
    return (
      <MobileLayout role="driver">
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MobileLayout>
    );
  }

  if (!profile || isPending) {
    return (
      <MobileLayout role="driver">
        <div className="p-4 pt-20 space-y-4">
          <Card className="p-6 rounded-2xl text-center">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold font-display mb-2">
              {lang === 'mg' ? 'Miandry fankatoavana' : 'En attente de validation'}
            </h2>
            <p className="text-muted-foreground mb-4">
              {lang === 'mg' 
                ? 'Ny antontan-taratasinao dia mbola jerena. Afaka 24 ora monja.'
                : 'Vos documents sont en cours de vérification. Cela peut prendre 24h.'}
            </p>
            <Button onClick={() => setLocation('/driver/documents')} className="rounded-xl">
              {lang === 'mg' ? 'Jereo ny antontan-taratasy' : 'Voir mes documents'}
            </Button>
          </Card>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout role="driver">
      {/* Carte */}
      <div className="absolute inset-0 z-0 pt-16">
        <MapView 
          center={mapCenter} 
          zoom={16}
          interactive={true} 
          markers={pickupMarkers}
          pickupMarker={pickupCoords}
          dropoffMarker={dropoffCoords}
          showRoute={!!routeCoords}
          routeCoordinates={routeCoords}
        />
      </div>

      {/* Indicateur de connexion */}
      <div className="absolute top-20 left-4 z-10">
        <div className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${
          connected ? 'bg-green-500/20 text-green-700' : 'bg-red-500/20 text-red-700'
        }`}>
          {connected ? (
            <><Wifi className="w-3 h-3" />{lang === 'mg' ? 'Mifandray' : 'Connecté'}</>
          ) : (
            <><WifiOff className="w-3 h-3" />{lang === 'mg' ? 'Tsy mifandray' : 'Déconnecté'}</>
          )}
        </div>
      </div>

      {/* Contrôle en ligne */}
      <div className="absolute top-20 right-4 z-10">
        <Card className="px-4 py-2 rounded-full shadow-lg flex items-center space-x-3 bg-background/90 backdrop-blur-sm border-0">
          <span className="font-bold text-sm">{isOnline ? t('online') : t('offline')}</span>
          <Switch 
            checked={isOnline} 
            onCheckedChange={(v) => setOnline.mutate(v)} 
            className="data-[state=checked]:bg-green-500"
          />
        </Card>
      </div>

      {/* Erreur GPS */}
      {locationError && (
        <div className="absolute top-32 left-1/2 -translate-x-1/2 z-10">
          <Alert variant="destructive" className="rounded-full py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{locationError}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* 🔥 AFFICHAGE DEBUG TEMPORAIRE - À SUPPRIMER PLUS TARD */}
      {activeRide && (
        <div className="absolute top-36 left-1/2 -translate-x-1/2 z-50 bg-yellow-100 text-black p-2 rounded text-xs">
          <div>Debug Prix: {formattedPrice} Ar</div>
          <div>Props dispo: {Object.keys(activeRide).join(', ')}</div>
        </div>
      )}

      {/* Fenêtre de suivi de course */}
      <AnimatePresence>
        {showRideTracking && activeRide && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="absolute bottom-0 w-full z-20 p-4"
          >
            <Card className="p-5 rounded-3xl shadow-2xl border-0 bg-background/95 backdrop-blur-xl">
              {/* En-tête avec timer */}
              <div className="flex justify-between items-center mb-4">
                <div>
                  <Badge className="mb-2" variant={
                    activeRide.status === 'DRIVER_ARRIVED' ? 'default' :
                    activeRide.status === 'IN_PROGRESS' ? 'secondary' : 'outline'
                  }>
                    {activeRide.status === 'ASSIGNED' && (lang === 'mg' ? 'Voatendry' : 'Assigné')}
                    {activeRide.status === 'DRIVER_EN_ROUTE' && (lang === 'mg' ? 'Eny an-dalana' : 'En route')}
                    {activeRide.status === 'DRIVER_ARRIVED' && (lang === 'mg' ? 'Tonga' : 'Arrivé')}
                    {activeRide.status === 'IN_PROGRESS' && (lang === 'mg' ? 'An-dalana' : 'En cours')}
                  </Badge>
                  {/* 🔥 CORRIGÉ: Affichage du prix avec fallback et debug */}
                  <h3 className="font-display font-bold text-xl">
                    {formattedPrice} Ar
                  </h3>
                </div>
                <div className="text-right">
                  {timerStarted || activeRide.status !== 'ASSIGNED' ? (
                    <div className="text-3xl font-bold font-mono text-primary">
                      {String(timeRemaining).padStart(2, '0')}:{String(timeRemainingSeconds).padStart(2, '0')}
                    </div>
                  ) : (
                    <div className="text-3xl font-bold font-mono text-primary">
                      {String(activeRide.etaMinutes).padStart(2, '0')}:00
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {lang === 'mg' ? 'sisa' : 'restant'}
                  </p>
                </div>
              </div>

              {/* Barre de progression - seulement si timer démarré */}
              {timerStarted && (
                <Progress 
                  value={(timeElapsed / activeRide.etaMinutes) * 100} 
                  className="h-2 mb-4"
                />
              )}

              {/* Infos passager */}
              <div className="bg-secondary/50 rounded-2xl p-4 mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold">{activeRide.passengerName}</p>
                    <a 
                      href={`tel:${activeRide.passengerPhone}`}
                      className="text-xs text-primary flex items-center gap-1"
                    >
                      <Phone className="w-3 h-3" />
                      {activeRide.passengerPhone}
                    </a>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs flex items-start gap-2">
                    <MapPin className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                    <span className="text-muted-foreground line-clamp-2">{activeRide.pickupAddress}</span>
                  </p>
                  <p className="text-xs flex items-start gap-2">
                    <Navigation className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                    <span className="text-muted-foreground line-clamp-2">{activeRide.dropAddress}</span>
                  </p>
                </div>
              </div>

              {/* Actions selon le statut */}
              <div className="space-y-3">
                {activeRide.status === 'ASSIGNED' && !timerStarted && (
                  <Button 
                    onClick={handleStartJourney}
                    className="w-full h-12 text-base font-bold rounded-xl bg-green-600 hover:bg-green-700 animate-pulse"
                    disabled={updateRideStatus.isPending}
                  >
                    {updateRideStatus.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Play className="w-4 h-4 mr-2" />
                    )}
                    {lang === 'mg' ? 'makanesa' : 'Venir'}
                  </Button>
                )}

                {activeRide.status === 'DRIVER_EN_ROUTE' && (
                  <>
                    <Button 
                      onClick={() => setShowArrivalConfirm(true)}
                      className="w-full h-12 text-base font-bold rounded-xl bg-green-600 hover:bg-green-700"
                      disabled={updateRideStatus.isPending}
                    >
                      <MapPinCheck className="w-4 h-4 mr-2" />
                      {lang === 'mg' ? 'Tonga' : 'Arrivé'}
                    </Button>

                    <div className="flex gap-2">
                      <Input
                        type="text"
                        value={etaAdjustment}
                        onChange={(e) => {
                          setEtaAdjustment(e.target.value);
                          setEtaAdjustmentError(null);
                        }}
                        placeholder={lang === 'mg' ? '5 min' : '5 min'}
                        className={`flex-1 h-12 text-center ${etaAdjustmentError ? 'border-destructive' : ''}`}
                        inputMode="numeric"
                      />
                      <Button
                        onClick={handleStillEnRoute}
                        variant="outline"
                        className="h-12 px-6"
                        disabled={extendEta.isPending}
                      >
                        {extendEta.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Clock className="w-4 h-4 mr-2" />
                        )}
                        {lang === 'mg' ? 'Mbola an-dalana' : 'Encore en route'}
                      </Button>
                    </div>
                    {etaAdjustmentError && (
                      <p className="text-xs text-destructive">{etaAdjustmentError}</p>
                    )}
                  </>
                )}

                {activeRide.status === 'DRIVER_ARRIVED' && (
                  <>
                    <Button 
                      onClick={handleStartRide}
                      className="w-full h-12 text-base font-bold rounded-xl bg-blue-600 hover:bg-blue-700"
                      disabled={updateRideStatus.isPending}
                    >
                      <Flag className="w-4 h-4 mr-2" />
                      {lang === 'mg' ? 'Manomboka ny dia' : 'Commencer la course'}
                    </Button>
                    
                    <p className="text-xs text-center text-muted-foreground">
                      {lang === 'mg' 
                        ? 'Afaka 5 minitra fiandrasana' 
                        : '5 minutes d\'attente incluses'}
                    </p>
                  </>
                )}

                {activeRide.status === 'IN_PROGRESS' && (
                  <Button 
                    onClick={() => {
                      if (activeRide) {
                        setShowCompletionConfirm(true);
                      }
                    }}
                    className="w-full h-12 text-base font-bold rounded-xl bg-green-600 hover:bg-green-700"
                    disabled={updateRideStatus.isPending || !activeRide}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {lang === 'mg' ? 'Vita ny dia' : 'Terminer la course'}
                  </Button>
                )}

                {/* Bouton d'annulation */}
                {activeRide.status !== 'COMPLETED' && activeRide.status !== 'CANCELED' && (
                  <Button
                    onClick={handleCancelRide}
                    variant="ghost"
                    className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    {lang === 'mg' ? 'Mamafa ny dia' : 'Annuler la course'}
                  </Button>
                )}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dialog de confirmation d'arrivée */}
      <Dialog open={showArrivalConfirm} onOpenChange={setShowArrivalConfirm}>
        <DialogContent className="rounded-3xl max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="text-center font-display text-xl">
              {lang === 'mg' ? 'Tonga ve ianao?' : 'Êtes-vous arrivé?'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center">
            <MapPinCheck className="w-16 h-16 text-green-500 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {lang === 'mg' 
                ? 'Rehefa manamafy ianao dia hisy 5 minitra fiandrasana ny mpandeha.'
                : 'En confirmant, vous aurez 5 minutes d\'attente pour le passager.'}
            </p>
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowArrivalConfirm(false)}
              className="flex-1"
            >
              {lang === 'mg' ? 'Tsy mbola' : 'Pas encore'}
            </Button>
            <Button
              onClick={handleArrived}
              className="flex-1 bg-green-600 hover:bg-green-700"
              disabled={updateRideStatus.isPending}
            >
              {updateRideStatus.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                lang === 'mg' ? 'Eny, tonga' : 'Oui, arrivé'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmation de fin de course */}
      <Dialog open={showCompletionConfirm && activeRide !== null} onOpenChange={setShowCompletionConfirm}>
        <DialogContent className="rounded-3xl max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="text-center font-display text-xl">
              {lang === 'mg' ? 'Vita ve ny dia?' : 'Course terminée?'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-3" />
            <p className="text-lg font-bold text-primary mb-1">
              {formattedPrice} Ar
            </p>
            <p className="text-sm text-muted-foreground">
              {lang === 'mg' 
                ? 'Tafiditra ao ny vola voaray'
                : 'Ce montant sera crédité sur votre compte'}
            </p>
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCompletionConfirm(false)}
              className="flex-1"
            >
              {lang === 'mg' ? 'Hiverina' : 'Retour'}
            </Button>
            <Button
              onClick={handleCompleteRide}
              className="flex-1 bg-green-600 hover:bg-green-700"
              disabled={updateRideStatus.isPending}
            >
              {updateRideStatus.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                lang === 'mg' ? 'Eny, vita' : 'Oui, terminé'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Liste des demandes */}
      <AnimatePresence>
        {isOnline && !activeRide && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-0 w-full z-10 p-4 max-h-[50vh] overflow-y-auto space-y-3"
          >
            {requestsLoading ? (
              <div className="p-4 text-center bg-background/80 backdrop-blur-md rounded-2xl">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {lang === 'mg' ? 'Mitady...' : 'Recherche...'}
                </p>
              </div>
            ) : requests.length === 0 ? (
              <div className="p-6 text-center bg-background/80 backdrop-blur-md rounded-2xl">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Navigation className="w-6 h-6 text-primary" />
                </div>
                <p className="font-medium mb-1">
                  {lang === 'mg' ? 'Tsy misy fangatahana' : 'Aucune demande'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {lang === 'mg' ? 'Miandrasa...' : 'En attente...'}
                </p>
              </div>
            ) : (
              requests.map((req: any) => {
                const isOfferSent = offerSentFor.has(req.id);
                
                return (
                  <Card key={req.id} className={`p-4 rounded-2xl shadow-float border-0 bg-background/95 backdrop-blur-xl transition-all ${isOfferSent ? 'opacity-75' : ''}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold flex items-center text-sm">
                          <MapPin className="w-4 h-4 mr-1 text-green-500 shrink-0"/> 
                          <span className="truncate">{req.pickupAddress}</span>
                        </p>
                        <p className="text-sm text-muted-foreground flex items-center mt-1">
                          <Navigation className="w-4 h-4 mr-1 shrink-0 text-red-400"/> 
                          <span className="truncate">{req.dropAddress}</span>
                        </p>
                        
                        {req.passenger?.name && (
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs font-medium">{req.passenger.name}</span>
                            </div>
                            {req.passenger?.phone && (
                              <a href={`tel:${req.passenger.phone}`} className="text-xs text-primary font-semibold flex items-center gap-0.5 hover:underline">
                                <Phone className="w-3 h-3" /> 
                                {lang === 'mg' ? 'Antsoy' : 'Appeler'}
                              </a>
                            )}
                          </div>
                        )}

                        {(req.distanceKm || req.etaMinutes) && (
                          <div className="flex gap-2 mt-2">
                            {req.distanceKm && (
                              <Badge variant="secondary" className="text-[10px] gap-1">
                                <Route className="w-2.5 h-2.5" /> 
                                {parseFloat(req.distanceKm as any).toFixed(1)} km
                              </Badge>
                            )}
                            {req.etaMinutes && (
                              <Badge variant="secondary" className="text-[10px] gap-1">
                                <Clock className="w-2.5 h-2.5" /> ~{req.etaMinutes} min
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>

                      <Badge className="ml-2 shrink-0">
                        {req.vehicleType === 'TAXI' ? <Car className="w-3 h-3 mr-1" /> : <Bike className="w-3 h-3 mr-1" />}
                        {req.vehicleType}
                      </Badge>
                    </div>

                    {isOfferSent ? (
                      <div className="w-full mt-2 h-10 rounded-xl bg-green-500/10 text-green-600 font-bold text-sm flex items-center justify-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        {lang === 'mg' ? 'Tolobidy nalefa' : 'Offre envoyée'}
                      </div>
                    ) : (
                      <Button 
                        onClick={() => {
                          setSelectedRequest(req);
                          setPrice('');
                          setPriceError(null);
                        }}
                        className="w-full mt-2 font-bold rounded-xl"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        {t('send_offer')}
                      </Button>
                    )}
                  </Card>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL D'ENVOI D'OFFRE */}
      <Dialog open={!!selectedRequest && !activeRide} onOpenChange={(open) => { 
        if (!open) {
          setSelectedRequest(null);
          setPrice('');
          setPriceError(null);
          setAutoEta(null);
          setCalculatingEta(false);
          if (etaTimeoutRef.current) clearTimeout(etaTimeoutRef.current);
        }
      }}>
        <DialogContent className="rounded-3xl sm:rounded-3xl border-0 shadow-2xl max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {t('send_offer')}
            </DialogTitle>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-4">
              <div className="text-xs bg-secondary/50 rounded-xl p-3 space-y-2">
                <p className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-green-500"/>
                  <span className="line-clamp-1">{selectedRequest.pickupAddress}</span>
                </p>
                <p className="flex items-center gap-1">
                  <Navigation className="w-3 h-3 text-red-400"/>
                  <span className="line-clamp-1">{selectedRequest.dropAddress}</span>
                </p>
                
                <div className="flex items-center gap-1 mt-2 pt-2 border-t">
                  <Clock className="w-3 h-3 text-primary"/>
                  {calculatingEta ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin ml-1" />
                      <span className="text-xs text-muted-foreground ml-1">
                        {lang === 'mg' ? 'Manatsara...' : 'Optimisation...'} ({autoEta || selectedRequest?.etaMinutes || 5} min)
                      </span>
                    </>
                  ) : (
                    <span className="font-semibold">
                      {lang === 'mg' 
                        ? `Fotoana: ~${autoEta || selectedRequest?.etaMinutes || 5} min`
                        : `Temps: ~${autoEta || selectedRequest?.etaMinutes || 5} min`}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold mb-1.5 block">
                  {lang === 'mg' ? 'Vidiny (Ar)' : 'Prix (Ar)'}
                </label>
                <Input 
                  type="text"
                  value={price} 
                  onChange={handlePriceChange}
                  placeholder="5000"
                  className={`h-12 text-lg rounded-xl ${priceError ? 'border-destructive' : ''}`}
                  inputMode="numeric"
                />
                {priceError && <p className="text-xs text-destructive mt-1">{priceError}</p>}
                <p className="text-xs text-muted-foreground mt-1">
                  {lang === 'mg' ? '1000 Ar ny farany ambany' : 'Minimum: 1000 Ar'}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button 
              onClick={handleSendOffer}
              disabled={!price || sendOffer.isPending}
              className="w-full h-12 text-lg font-bold rounded-xl"
            >
              {sendOffer.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{lang === 'mg' ? 'Mandefa...' : 'Envoi...'}</>
              ) : (
                lang === 'mg' ? 'Andefa tolobidy' : 'Envoyer l\'offre'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MobileLayout>
  );
}