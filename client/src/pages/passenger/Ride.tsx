// src/pages/passenger/Ride.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRoute, useLocation } from 'wouter';
import { MobileLayout } from '@/components/RoleLayout';
import { MapView, DriverMarkerInfo, fetchOSRMRoute } from '@/components/Map';
import { useRide, useRideOffers, useAcceptOffer, useCancelRide, useRateRide } from '@/hooks/use-passenger';
import { useWebSocket } from '@/hooks/use-websocket';
import { useTranslation } from '@/lib/i18n';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Clock, Navigation2, CheckCircle2, User, Phone, XCircle, Star,
  ShieldAlert, Share2, MapPin, Route, Eye, Car, Bike, X,
  MessageCircle, AlertTriangle, Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AdBanner } from '@/components/AdBanner';
import ChatBox from '@/components/ChatBox';

// Raisons d'annulation
const CANCEL_REASONS = {
  mg: [
    { id: 'CHANGED_MIND', label: 'Nanova hevitra' },
    { id: 'WRONG_ADDRESS', label: 'Adiresy diso' },
    { id: 'TOO_LONG_WAIT', label: 'Andrasana ela loatra' },
    { id: 'DRIVER_NOT_RESPONDING', label: 'Tsy mamaly ny mpamily' },
    { id: 'PRICE_TOO_HIGH', label: 'Vidiny lafo loatra' },
    { id: 'VEHICLE_ISSUE', label: 'Olana amin\'ny fiara' },
    { id: 'OTHER', label: 'Hafa' },
  ],
  fr: [
    { id: 'CHANGED_MIND', label: 'J\'ai changé d\'avis' },
    { id: 'WRONG_ADDRESS', label: 'Mauvaise adresse' },
    { id: 'TOO_LONG_WAIT', label: 'Attente trop longue' },
    { id: 'DRIVER_NOT_RESPONDING', label: 'Le chauffeur ne répond pas' },
    { id: 'PRICE_TOO_HIGH', label: 'Prix trop élevé' },
    { id: 'VEHICLE_ISSUE', label: 'Problème de véhicule' },
    { id: 'OTHER', label: 'Autre' },
  ]
};

export default function PassengerRide() {
  const [, params] = useRoute('/passenger/ride/:id');
  const rideId = params?.id ? parseInt(params.id) : null;
  const { t, lang } = useTranslation();
  const { toast } = useToast();
  const { data: ride, refetch: refetchRide } = useRide(rideId);
  const { data: offers = [] } = useRideOffers(rideId);
  const acceptOffer = useAcceptOffer(rideId!);
  const cancelRide = useCancelRide(rideId!);
  const rateRide = useRateRide(rideId!);
  const { connected, subscribe } = useWebSocket();
  const queryClient = useQueryClient();

  const wsSubscribedRef = useRef(false);

  // Timer expiration des offres
  const [offerExpiry, setOfferExpiry] = useState<Record<number, number>>({});

  useEffect(() => {
    const intervals: NodeJS.Timeout[] = [];
    offers.forEach((offer: any) => {
      if (offer.expiresAt) {
        const expiryTime = new Date(offer.expiresAt).getTime();
        const interval = setInterval(() => {
          const remaining = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
          setOfferExpiry(prev => ({ ...prev, [offer.id]: remaining }));
          if (remaining <= 0) clearInterval(interval);
        }, 1000);
        intervals.push(interval);
      }
    });
    return () => intervals.forEach(clearInterval);
  }, [offers]);

  // États
  const [showChat, setShowChat] = useState(false);
  const [chatMinimized, setChatMinimized] = useState(false);
  const [otherUserName, setOtherUserName] = useState('');
  const [otherUserId, setOtherUserId] = useState(0);
  const [otherUserPhone, setOtherUserPhone] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedCancelReason, setSelectedCancelReason] = useState<string | null>(null);
  const [cancelComment, setCancelComment] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [showAdBanner, setShowAdBanner] = useState(true);
  const [selectedRating, setSelectedRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [hasRated, setHasRated] = useState(false);
  const [showSOS, setShowSOS] = useState(false);
  const [assignedDriverLoc, setAssignedDriverLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [routeCoords, setRouteCoords] = useState<[number, number][] | undefined>(undefined);

  // Récupération de l'utilisateur courant
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(res => res.ok && res.json())
      .then(user => { if (user) { setCurrentUser(user); localStorage.setItem('user', JSON.stringify(user)); } })
      .catch(console.error);
  }, []);

  // Fermeture du chat si course terminée
  useEffect(() => {
    if (ride && (ride.status === 'COMPLETED' || ride.status === 'CANCELED')) {
      setShowChat(false);
      setChatMinimized(false);
    }
  }, [ride]);

  // Ouverture automatique du chat si course active
  useEffect(() => {
    if (!ride) return;
    const activeStatuses = ['ASSIGNED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'IN_PROGRESS'];
    if (activeStatuses.includes(ride.status) && ride.driverId && !showChat && ride.driver) {
      setOtherUserName(ride.driver.name || 'Chauffeur');
      setOtherUserId(ride.driverId);
      setOtherUserPhone(ride.driver.phone || '');
      setShowChat(true);
      setChatMinimized(false);
    }
  }, [ride, showChat]);

  // Souscriptions WebSocket (une seule fois)
  useEffect(() => {
    if (!connected || wsSubscribedRef.current) return;
    wsSubscribedRef.current = true;

    const unsubOfferAccepted = subscribe('OFFER_ACCEPTED', (data: any) => {
      if (data.rideId === rideId) {
        setOtherUserName(data.driverName || 'Chauffeur');
        setOtherUserId(data.driverId);
        setOtherUserPhone(data.driverPhone || '');
        setShowChat(true);
        setChatMinimized(false);
        toast({ title: lang === 'mg' ? "Tolobidy voaray!" : "Offre acceptée!", description: lang === 'mg' ? `Ny mpamily ${data.driverName} dia ho tonga` : `Le chauffeur ${data.driverName} va arriver`, className: "mobile-toast" });
      }
    });

    const unsubStatus = subscribe('RIDE_STATUS_CHANGED', (data: any) => {
      if (data.id === rideId) refetchRide();
    });

    const unsubLoc = subscribe('DRIVER_LOCATION', (data: any) => {
      if (data.rideId === rideId) setAssignedDriverLoc({ lat: data.lat, lng: data.lng });
    });

    return () => {
      unsubOfferAccepted();
      unsubStatus();
      unsubLoc();
      wsSubscribedRef.current = false;
    };
  }, [connected, rideId, subscribe, refetchRide, toast, lang]);

  // Polling position conducteur (fallback) avec vérification de visibilité
  useEffect(() => {
    if (!ride?.driverId) return;
    const active = ['ASSIGNED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'IN_PROGRESS'];
    if (!active.includes(ride.status)) return;
    const interval = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetch(`/api/driver/${ride.driverId}/location`, { credentials: 'include' });
        if (res.ok) { const data = await res.json(); if (data?.lat) setAssignedDriverLoc(data); }
      } catch {}
    }, 15000);
    return () => clearInterval(interval);
  }, [ride?.driverId, ride?.status]);

  // Calcul de l'itinéraire
  useEffect(() => {
    if (ride?.pickupLat && ride?.dropLat) {
      const p = { lat: parseFloat(ride.pickupLat as any), lng: parseFloat(ride.pickupLng as any) };
      const d = { lat: parseFloat(ride.dropLat as any), lng: parseFloat(ride.dropLng as any) };
      fetchOSRMRoute(p, d).then(res => { if (res) setRouteCoords(res.coordinates); });
    }
  }, [ride?.pickupLat, ride?.pickupLng, ride?.dropLat, ride?.dropLng]);

  const [, navigate] = useLocation();
  useEffect(() => {
    if (ride && (ride.status === 'COMPLETED' || ride.status === 'CANCELED')) {
      const timeout = setTimeout(() => navigate('/passenger'), 2000);
      return () => clearTimeout(timeout);
    }
  }, [ride, navigate]);

  const handleCancelWithReason = async () => {
    if (!selectedCancelReason) {
      toast({ variant: "destructive", title: lang === 'mg' ? "Tsy voafidy ny antony" : "Raison non sélectionnée", className: "mobile-toast" });
      return;
    }
    setIsCancelling(true);
    const reasons = lang === 'mg' ? CANCEL_REASONS.mg : CANCEL_REASONS.fr;
    const selectedLabel = reasons.find(r => r.id === selectedCancelReason)?.label || selectedCancelReason;
    const finalReason = cancelComment ? `${selectedLabel}: ${cancelComment}` : selectedLabel;
    try {
      await cancelRide.mutateAsync(finalReason);
      setShowCancelDialog(false);
      setSelectedCancelReason(null);
      setCancelComment('');
    } finally { setIsCancelling(false); }
  };

  const { data: viewsData } = useQuery<{ viewCount: number }>({
    queryKey: ['/api/rides', rideId, 'views'],
    queryFn: async () => {
      const res = await fetch(`/api/rides/${rideId}/views`, { credentials: 'include' });
      if (res.status === 429) return { viewCount: 0 };
      return res.json();
    },
    enabled: !!rideId && !!ride && (ride?.status === 'REQUESTED' || ride?.status === 'BIDDING'),
    refetchInterval: (query) => {
      if (document.visibilityState !== 'visible') return false;
      return 30000;
    },
    refetchIntervalInBackground: false,
  });

  const handleSubmitRating = () => {
    if (selectedRating === 0) return;
    rateRide.mutate(
      { rating: selectedRating, comment: ratingComment || undefined },
      { onSuccess: () => { setHasRated(true); toast({ title: "Misaotra!", description: lang === 'mg' ? "Voaray ny naoty nomenao." : "Note enregistrée.", className: "mobile-toast" }); },
        onError: () => toast({ title: "Nisy olana", description: lang === 'mg' ? "Tsy afaka nanome naoty." : "Erreur lors de la notation.", variant: "destructive", className: "mobile-toast" }) }
    );
  };

  if (!ride) {
    return (
      <MobileLayout role="passenger">
        <div className="flex h-full items-center justify-center pt-16">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </MobileLayout>
    );
  }

  const isBidding = ride.status === 'REQUESTED' || ride.status === 'BIDDING';
  const isActive = ['ASSIGNED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'IN_PROGRESS'].includes(ride.status);
  const isCompleted = ride.status === 'COMPLETED';

  const pickupCoords = { lat: parseFloat(ride.pickupLat as any), lng: parseFloat(ride.pickupLng as any) };
  const dropoffCoords = ride.dropLat ? { lat: parseFloat(ride.dropLat as any), lng: parseFloat(ride.dropLng as any) } : null;

  const offerDriverMarkers: DriverMarkerInfo[] = offers.filter((o: any) => o.location).map((o: any) => ({
    lat: o.location.lat, lng: o.location.lng, name: o.driver?.name, phone: o.driver?.phone,
    vehicleType: o.profile?.vehicleType, rating: o.profile?.ratingAvg ? parseFloat(o.profile.ratingAvg) : undefined, ratingCount: o.profile?.ratingCount,
  }));

  const assignedDriverMarker: DriverMarkerInfo[] = [];
  if (isActive && assignedDriverLoc) {
    assignedDriverMarker.push({ lat: assignedDriverLoc.lat, lng: assignedDriverLoc.lng, name: ride.driver?.name, phone: ride.driver?.phone, vehicleType: ride.vehicleType, isAssigned: true });
  }
  const allDriverMarkers = [...offerDriverMarkers, ...assignedDriverMarker];

  const statusLabels: Record<string, { mg: string; fr: string; color: string }> = {
    REQUESTED: { mg: 'Mitady mpamily...', fr: 'Recherche de chauffeurs...', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    BIDDING: { mg: 'Misy tolo-bidy', fr: 'Offres en cours', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    ASSIGNED: { mg: 'Voatendry ny mpamily', fr: 'Chauffeur assigné', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    DRIVER_EN_ROUTE: { mg: 'Eny an-dalana ny mpamily', fr: 'Chauffeur en route', color: 'bg-primary/10 text-primary border-primary/20' },
    DRIVER_ARRIVED: { mg: 'Tonga ny mpamily!', fr: 'Chauffeur arrivé!', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    IN_PROGRESS: { mg: 'Eny an-dalana...', fr: 'En cours...', color: 'bg-primary/10 text-primary border-primary/20' },
    COMPLETED: { mg: 'Vita ny dia', fr: 'Course terminée', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    CANCELED: { mg: 'Nofoanana', fr: 'Annulée', color: 'bg-red-100 text-red-700 border-red-200' },
  };
  const statusInfo = statusLabels[ride.status] || statusLabels.REQUESTED;
  const cancelReasons = lang === 'mg' ? CANCEL_REASONS.mg : CANCEL_REASONS.fr;

  return (
    <MobileLayout role="passenger">
      {/* Indicateur WebSocket */}
      <div className="absolute top-4 left-4 z-30">
        <div className={`px-2 py-1 rounded-full text-xs font-medium ${connected ? 'bg-emerald-500/20 text-emerald-700' : 'bg-red-500/20 text-red-700'}`}>
          {connected ? '● Connecté' : '○ Déconnecté'}
        </div>
      </div>

      {isActive && showAdBanner && (
        <div className="absolute top-14 left-0 right-0 z-20 px-3 pointer-events-none">
          <div className="pointer-events-auto relative bg-background/95 backdrop-blur-xl rounded-xl shadow-lg border">
            <Button variant="ghost" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background shadow-md z-10" onClick={() => setShowAdBanner(false)}><X className="w-3 h-3" /></Button>
            <AdBanner position="RIDE_SCREEN" />
          </div>
        </div>
      )}

      <div className="absolute inset-0 z-0 pt-14">
        <MapView center={pickupCoords} zoom={15} pickupMarker={pickupCoords} dropoffMarker={dropoffCoords} driverMarkers={allDriverMarkers} pickupVehicleType={ride.vehicleType} showRoute={true} interactive={true} routeCoordinates={routeCoords} />
      </div>

      <AnimatePresence>
        {isBidding && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="absolute bottom-0 w-full z-10 p-3 max-h-[65vh] flex flex-col">
            <div className="bg-background/95 backdrop-blur-xl rounded-3xl shadow-xl border-0 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-border/30 relative shrink-0">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={`${statusInfo.color} px-2.5 py-0.5 text-xs font-bold`}>{lang === 'mg' ? statusInfo.mg : statusInfo.fr}</Badge>
                  {viewsData && <span className="text-xs text-muted-foreground flex items-center gap-1"><Eye className="w-3 h-3" /> {viewsData.viewCount} {lang === 'mg' ? 'mpamily nahita' : 'chauffeurs ont vu'}</span>}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><MapPin className="w-3 h-3 text-emerald-500" /><span className="truncate flex-1">{ride.pickupAddress}</span></div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="w-3 h-3 text-red-500" /><span className="truncate flex-1">{ride.dropAddress}</span></div>
                {(ride.distanceKm || ride.etaMinutes) && <div className="flex gap-2 mt-2">{ride.distanceKm && <span className="text-xs bg-secondary/60 px-2 py-0.5 rounded-full flex items-center gap-1"><Route className="w-3 h-3" /> {parseFloat(ride.distanceKm as any).toFixed(1)} km</span>}{ride.etaMinutes && <span className="text-xs bg-secondary/60 px-2 py-0.5 rounded-full flex items-center gap-1"><Clock className="w-3 h-3" /> ~{ride.etaMinutes} min</span>}</div>}
                <Button variant="ghost" size="icon" className="absolute right-3 top-3 text-muted-foreground hover:text-red-500" onClick={() => setShowCancelDialog(true)}><XCircle className="w-5 h-5" /></Button>
              </div>
              <div className="p-3 border-b border-border/30 shrink-0"><p className="text-xs font-bold text-muted-foreground">{offers.length === 0 ? (lang === 'mg' ? 'Miandry tolo-bidy...' : 'En attente d\'offres...') : `${offers.length} ${lang === 'mg' ? 'tolo-bidy voaray' : 'offre(s) reçue(s)'}`}</p></div>
              <div className="overflow-y-auto p-3 space-y-2.5 shrink min-h-0">
                {offers.length === 0 ? (
                  <div className="py-6 text-center"><div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3"><Navigation2 className="w-6 h-6 text-primary animate-pulse" /></div><p className="text-sm text-muted-foreground">{lang === 'mg' ? 'Mitady mpamily akaiky...' : 'Recherche de chauffeurs à proximité...'}</p></div>
                ) : (
                  offers.map((offer: any) => {
                    const rating = offer.profile?.ratingAvg ? parseFloat(offer.profile.ratingAvg) : 0;
                    const rCount = offer.profile?.ratingCount || 0;
                    const vType = offer.profile?.vehicleType || ride.vehicleType;
                    const remaining = offerExpiry[offer.id] ?? 0;
                    const isExpired = remaining === 0 && offer.expiresAt && new Date(offer.expiresAt) < new Date();
                    return (
                      <Card key={offer.id} className={`p-3 rounded-2xl border transition-colors shadow-sm ${isExpired ? 'opacity-50 border-red-200' : 'hover:border-primary/50'}`}>
                        <div className="flex justify-between items-start mb-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-11 h-11 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full flex items-center justify-center relative">
                              <User className="w-5 h-5 text-primary" />
                              {offer.location && <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white" />}
                            </div>
                            <div>
                              <p className="font-bold text-sm">{offer.driver?.name || 'Mpamily'}</p>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                {rating > 0 ? <span className="flex items-center gap-0.5 font-semibold"><Star className="w-3 h-3 fill-amber-400 text-amber-400" /><span className="text-amber-600">{rating.toFixed(1)}</span><span className="text-muted-foreground/60">({rCount})</span></span> : <span className="text-muted-foreground/60 italic">{lang === 'mg' ? 'Vaovao' : 'Nouveau'}</span>}
                                <span className="text-muted-foreground/30">•</span>
                                <span className="flex items-center gap-0.5">{vType === 'TAXI' ? <Car className="w-3 h-3" /> : <Bike className="w-3 h-3" />}{vType}</span>
                                {offer.vehicleDetails?.vehicleNumber && <><span className="text-muted-foreground/30">•</span><span>{offer.vehicleDetails.vehicleNumber}</span></>}
                              </div>
                              {(offer.vehicleDetails?.vehicleMake || offer.vehicleDetails?.vehicleModel) && <div className="text-[10px] text-muted-foreground mt-0.5">{offer.vehicleDetails.vehicleMake} {offer.vehicleDetails.vehicleModel}{offer.vehicleDetails.vehicleColor && ` (${offer.vehicleDetails.vehicleColor})`}</div>}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg font-display text-primary leading-tight">{offer.priceAr.toLocaleString()} <span className="text-xs">Ar</span></p>
                            <p className="text-xs text-muted-foreground flex items-center justify-end gap-0.5"><Clock className="w-3 h-3" /> {offer.etaMinutes} min</p>
                          </div>
                        </div>
                        {offer.message && <p className="text-xs text-muted-foreground bg-secondary/40 rounded-lg px-2.5 py-1.5 mb-2.5 italic">"{offer.message}"</p>}
                        {!isExpired && remaining > 0 && <div className="text-xs text-amber-600 flex items-center gap-1 mb-2"><Clock className="w-3 h-3" /> expire dans {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</div>}
                        {isExpired && <div className="text-xs text-red-500 mb-2">Offre expirée</div>}
                        <div className="flex gap-2 justify-center">
                          <Button onClick={() => acceptOffer.mutate(offer.id)} disabled={acceptOffer.isPending || isExpired} className="w-auto min-w-[100px] font-bold bg-gradient-to-r from-primary to-primary/80 rounded-xl h-8 text-xs">{t('accept')}</Button>
                          {offer.driver?.phone && <Button variant="outline" size="icon" className="rounded-xl h-8 w-8 shrink-0" onClick={() => window.location.href = `tel:${offer.driver.phone}`}><Phone className="w-3.5 h-3.5 text-emerald-600" /></Button>}
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>
        )}

        {isActive && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} className="absolute bottom-0 w-full z-10 p-3">
            <Card className="p-4 rounded-3xl shadow-xl border-0 bg-background/95 backdrop-blur-xl">
              <div className="flex justify-between items-center mb-3">
                <Badge className={`${statusInfo.color} px-2.5 py-0.5 text-xs font-bold`}>{lang === 'mg' ? statusInfo.mg : statusInfo.fr}</Badge>
                <div className="font-display font-bold text-lg text-primary">{ride.selectedPriceAr?.toLocaleString()} Ar</div>
              </div>
              {(ride.distanceKm || ride.etaMinutes) && <div className="flex gap-2 mb-3">{ride.distanceKm && <div className="flex items-center gap-1 text-xs bg-secondary/60 px-2 py-0.5 rounded-full"><Route className="w-3 h-3" /> {parseFloat(ride.distanceKm as any).toFixed(1)} km</div>}{ride.etaMinutes && <div className="flex items-center gap-1 text-xs bg-secondary/60 px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" /> ~{ride.etaMinutes} min</div>}</div>}
              <div className="flex items-center p-3 bg-secondary/50 rounded-2xl mb-3">
                <div className="w-11 h-11 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full flex items-center justify-center mr-3 relative">
                  <User className="w-5 h-5 text-primary" />
                  {assignedDriverLoc && <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white animate-pulse" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm">{ride.driver?.name || 'Mpamily'}</h4>
                  <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>{ride.vehicleType}</span>
                      {ride.vehicleDetails?.vehicleNumber && (<><span className="text-muted-foreground/30">•</span><span>{ride.vehicleDetails.vehicleNumber}</span></>)}
                    </div>
                    {(ride.vehicleDetails?.vehicleMake || ride.vehicleDetails?.vehicleModel) && <div className="text-xs">{ride.vehicleDetails.vehicleMake} {ride.vehicleDetails.vehicleModel}{ride.vehicleDetails.vehicleColor && ` (${ride.vehicleDetails.vehicleColor})`}</div>}
                    {ride.driver?.phone && <a href={`tel:${ride.driver.phone}`} className="text-primary font-medium flex items-center gap-1"><Phone className="w-3 h-3" /> {ride.driver.phone}</a>}
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="icon" variant="outline" className="rounded-full w-9 h-9" onClick={() => { if (navigator.share) navigator.share({ title: 'Ny diako - Farady', text: `Mpamily: ${ride.driver?.name || 'Mpamily'}\nFinday: ${ride.driver?.phone || ''}\nFiara: ${ride.vehicleType}\nVidiny: ${ride.selectedPriceAr} Ar` }).catch(() => {}); else toast({ title: "Zaraina ny dia", description: `Mpamily: ${ride.driver?.name}, ${ride.vehicleType}`, className: "mobile-toast" }); }}><Share2 className="w-4 h-4" /></Button>
                  <Button size="icon" className="rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 w-9 h-9 hover:bg-emerald-600" onClick={() => window.location.href = `tel:${ride.driver?.phone || ''}`}><Phone className="w-4 h-4" /></Button>
                  <Button size="icon" variant="outline" className="rounded-full w-9 h-9" onClick={() => setShowChat(!showChat)}><MessageCircle className="w-4 h-4" /></Button>
                </div>
              </div>
              <div className="flex gap-2 justify-center">
                {ride.status !== 'IN_PROGRESS' && <Button variant="destructive" onClick={() => setShowCancelDialog(true)} className="w-auto min-w-[120px] h-9 rounded-xl font-bold text-sm">{t('cancel')}</Button>}
                <Button variant="destructive" onClick={() => setShowSOS(true)} className="w-auto min-w-[120px] h-9 rounded-xl font-bold px-3 text-sm bg-red-500 hover:bg-red-600"><ShieldAlert className="w-3.5 h-3.5 mr-1" /> SOS</Button>
              </div>
            </Card>
          </motion.div>
        )}

        {isCompleted && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} className="absolute bottom-0 w-full z-10 p-3">
            <Card className="p-4 rounded-3xl shadow-xl border-0 bg-background/95 backdrop-blur-xl">
              {hasRated ? (
                <div className="text-center py-6"><CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" /><h3 className="font-bold text-lg font-display mb-1">Misaotra anao!</h3><p className="text-sm text-muted-foreground">{lang === 'mg' ? 'Voaray ny naoty nomenao' : 'Note enregistrée'}</p></div>
              ) : (
                <>
                  <div className="text-center mb-4"><CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" /><h3 className="font-bold text-lg font-display">{lang === 'mg' ? 'Vita ny dia!' : 'Course terminée!'}</h3><p className="text-sm text-muted-foreground">{lang === 'mg' ? 'Omeo naoty ny mpamily' : 'Notez le chauffeur'}</p></div>
                  <div className="flex justify-center gap-2 mb-4">{[...Array(5)].map((_, i) => <button key={i} onMouseEnter={() => setHoverRating(i+1)} onMouseLeave={() => setHoverRating(0)} onClick={() => setSelectedRating(i+1)} className="p-1 transition-transform active:scale-110"><Star className={`w-8 h-8 transition-colors ${(i+1) <= (hoverRating || selectedRating) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} /></button>)}</div>
                  <Textarea placeholder={lang === 'mg' ? "Hafatra fanampiny (tsy voatery)" : "Commentaire (optionnel)"} value={ratingComment} onChange={(e) => setRatingComment(e.target.value)} className="mb-3 rounded-xl resize-none" rows={2} />
                  <Button onClick={handleSubmitRating} disabled={selectedRating === 0 || rateRide.isPending} className="w-full font-bold bg-gradient-to-r from-primary to-primary/80 rounded-xl h-10">{rateRide.isPending ? (lang === 'mg' ? 'Mandefitra...' : 'Envoi...') : (lang === 'mg' ? 'Alefaso ny naoty' : 'Envoyer la note')}</Button>
                </>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dialog d'annulation */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="rounded-3xl max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              {lang === 'mg' ? 'Hanaisotra ny dia?' : 'Annuler la course?'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">{lang === 'mg' ? 'Safidio ny antony hanafoanana ny dia:' : 'Veuillez sélectionner la raison de l\'annulation :'}</p>
            <div className="grid grid-cols-1 gap-2">
              {cancelReasons.map((reason) => (
                <button key={reason.id} onClick={() => setSelectedCancelReason(reason.id)} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${selectedCancelReason === reason.id ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : 'border-border/50 hover:border-muted-foreground/30'}`}>
                  <span className="text-xl">{reason.icon}</span>
                  <span className="text-sm font-medium flex-1">{reason.label}</span>
                  {selectedCancelReason === reason.id && <CheckCircle2 className="w-5 h-5 text-red-500" />}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{lang === 'mg' ? 'Fanazavana fanampiny (tsy voatery)' : 'Commentaire supplémentaire (optionnel)'}</label>
              <Textarea placeholder={lang === 'mg' ? 'Soraty eto ny antony...' : 'Écrivez votre raison ici...'} value={cancelComment} onChange={(e) => setCancelComment(e.target.value)} className="rounded-xl resize-none" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => { setShowCancelDialog(false); setSelectedCancelReason(null); setCancelComment(''); }} disabled={isCancelling}>
                {lang === 'mg' ? 'Ajanony' : 'Retour'}
              </Button>
              <Button variant="destructive" className="flex-1 rounded-xl" onClick={handleCancelWithReason} disabled={!selectedCancelReason || isCancelling}>
                {isCancelling ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{lang === 'mg' ? 'Hofoanana...' : 'Annulation...'}</> : (lang === 'mg' ? 'Hanafoana ny dia' : 'Annuler la course')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chat Box */}
      {showChat && rideId && currentUser && otherUserId > 0 && (
        <ChatBox
          rideId={rideId}
          currentUserId={currentUser.id}
          otherUserId={otherUserId}
          otherUserName={otherUserName}
          otherUserPhone={otherUserPhone}
          isOpen={showChat}
          minimized={chatMinimized}
          onClose={() => { setShowChat(false); setChatMinimized(false); }}
          onMinimize={() => setChatMinimized(true)}
        />
      )}

      {/* SOS Dialog */}
      <Dialog open={showSOS} onOpenChange={setShowSOS}>
        <DialogContent className="rounded-3xl sm:rounded-3xl border-0 shadow-2xl max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="text-red-600 font-display text-xl flex items-center gap-2">
              <ShieldAlert className="w-6 h-6" /> SOS - Urgence
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <a href="tel:117" className="flex items-center gap-3 p-3.5 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-900">
              <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center text-white shrink-0"><Phone className="w-5 h-5" /></div>
              <div><p className="font-bold text-sm">Police - 117</p><p className="text-xs text-muted-foreground">Appel d'urgence police</p></div>
            </a>
            <a href="tel:118" className="flex items-center gap-3 p-3.5 bg-orange-50 dark:bg-orange-950/30 rounded-xl border border-orange-200 dark:border-orange-900">
              <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white shrink-0"><Phone className="w-5 h-5" /></div>
              <div><p className="font-bold text-sm">Ambulance - 118</p><p className="text-xs text-muted-foreground">Appel d'urgence médical</p></div>
            </a>
            <button onClick={() => { if (navigator.share) navigator.share({ title: 'SOS - Farady', text: `J'ai besoin d'aide! Chauffeur: ${ride.driver?.name || ''}, Véhicule: ${ride.vehicleType}, Départ: ${ride.pickupAddress}, Arrivée: ${ride.dropAddress}` }).catch(() => {}); toast({ title: "Position partagée", className: "mobile-toast" }); setShowSOS(false); }} className="flex items-center gap-3 p-3.5 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-900 w-full text-left">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white shrink-0"><Share2 className="w-5 h-5" /></div>
              <div><p className="font-bold text-sm">Partager ma position</p><p className="text-xs text-muted-foreground">Envoyer à un proche</p></div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </MobileLayout>
  );
}