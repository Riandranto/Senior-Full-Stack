import { useState, useEffect, useCallback, useRef } from 'react';
import { useRoute } from 'wouter';
import { MobileLayout } from '@/components/RoleLayout';
import { MapView, DriverMarkerInfo, fetchOSRMRoute } from '@/components/Map';
import { useRide, useRideOffers, useAcceptOffer, useCancelRide, useRateRide } from '@/hooks/use-passenger';
import { useWebSocket } from '@/hooks/use-websocket';
import { useTranslation } from '@/lib/i18n';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Clock, Navigation2, CheckCircle2, User, Phone, XCircle, Star, ShieldAlert, Share2, MapPin, Route, Eye, Car, Bike, X, MessageCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AdBanner } from '@/components/AdBanner';
import ChatBox from '@/components/ChatBox';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@shared/routes';

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
  const { connected, subscribe, sendMessage } = useWebSocket();
  
  const queryClient = useQueryClient();

  // Chat states
  const [showChat, setShowChat] = useState(false);
  const [otherUserName, setOtherUserName] = useState('');
  const [otherUserId, setOtherUserId] = useState(0);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Ad banner states
  const [showAdBanner, setShowAdBanner] = useState(true);
  const [selectedRating, setSelectedRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [hasRated, setHasRated] = useState(false);
  const [showSOS, setShowSOS] = useState(false);
  const [assignedDriverLoc, setAssignedDriverLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [routeCoords, setRouteCoords] = useState<[number, number][] | undefined>(undefined);

  // Récupérer l'utilisateur courant
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setCurrentUser(JSON.parse(storedUser));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    // Fermer le chat quand la course est terminée ou annulée
    if (ride && (ride.status === 'COMPLETED' || ride.status === 'CANCELED')) {
      setShowChat(false);
    }
  }, [ride]);

  // ⚠️ ATTENTION: isBidding et autres variables doivent être définies APRÈS tous les hooks
  // mais AVANT leur utilisation dans les useEffect qui en dépendent.
  // Nous allons les définir à partir de ride, qui est chargé asynchrone.

  // useEffect pour le polling actif - FIXED
  useEffect(() => {
    if (!rideId) return;
    
    const interval = setInterval(() => {
      refetchRide();
    }, 3000);
    
    return () => clearInterval(interval);
  }, [rideId, refetchRide]);

  // useEffect pour recharger les offres périodiquement - FIXED (vérifie ride après chargement)
  useEffect(() => {
    if (!rideId) return;
    if (!ride) return; // Attendre que ride soit chargé
    
    const isBidding = ride.status === 'REQUESTED' || ride.status === 'BIDDING';
    if (!isBidding) return;
    
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['/api/rides', rideId, 'offers'] });
    }, 5000);
    
    return () => clearInterval(interval);
  }, [rideId, ride, queryClient]);

  useEffect(() => {
    if (ride?.pickupLat && ride?.dropLat) {
      const p = { lat: parseFloat(ride.pickupLat as any), lng: parseFloat(ride.pickupLng as any) };
      const d = { lat: parseFloat(ride.dropLat as any), lng: parseFloat(ride.dropLng as any) };
      fetchOSRMRoute(p, d).then(result => {
        if (result) setRouteCoords(result.coordinates);
      });
    }
  }, [ride?.pickupLat, ride?.pickupLng, ride?.dropLat, ride?.dropLng]);

  const { data: viewsData } = useQuery<{ viewCount: number }>({
    queryKey: ['/api/rides', rideId, 'views'],
    queryFn: async () => {
      const res = await fetch(`/api/rides/${rideId}/views`, { credentials: 'include' });
      return res.json();
    },
    enabled: !!rideId && !!ride && (ride?.status === 'REQUESTED' || ride?.status === 'BIDDING'),
    refetchInterval: 10000,
  });

  const { data: driverLocData } = useQuery({
    queryKey: ['/api/driver', ride?.driverId, 'location'],
    queryFn: async () => {
      const res = await fetch(`/api/driver/${ride?.driverId}/location`, { credentials: 'include' });
      return res.json();
    },
    enabled: !!ride?.driverId && !!ride && ['ASSIGNED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'IN_PROGRESS'].includes(ride?.status || ''),
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (driverLocData && driverLocData.lat) {
      setAssignedDriverLoc(driverLocData);
    }
  }, [driverLocData]);

  useEffect(() => {
    const unsub = subscribe('DRIVER_LOCATION', (data: any) => {
      if (data.rideId === rideId) {
        setAssignedDriverLoc({ lat: data.lat, lng: data.lng });
      }
    });
    return unsub;
  }, [subscribe, rideId]);

  // Écouter les événements de statut de course
  useEffect(() => {
    const unsub = subscribe('RIDE_STATUS_CHANGED', (data: any) => {
      if (data.id === rideId) {
        refetchRide();
      }
    });
    return unsub;
  }, [subscribe, rideId, refetchRide]);

  // Ouvrir le chat automatiquement quand la course est assignée
  useEffect(() => {
    if (ride && (ride.status === 'ASSIGNED' || ride.status === 'DRIVER_EN_ROUTE' || ride.status === 'DRIVER_ARRIVED' || ride.status === 'IN_PROGRESS')) {
      setOtherUserName(ride.driver?.name || 'Chauffeur');
      setOtherUserId(ride.driverId);
      setShowChat(true);
    }
  }, [ride]);

  const handleSubmitRating = () => {
    if (selectedRating === 0) return;
    rateRide.mutate(
      { rating: selectedRating, comment: ratingComment || undefined },
      {
        onSuccess: () => {
          setHasRated(true);
          toast({ title: "Misaotra!", description: lang === 'mg' ? "Voaray ny naoty nomenao." : "Note enregistrée." });
        },
        onError: () => {
          toast({ title: "Nisy olana", description: lang === 'mg' ? "Tsy afaka nanome naoty." : "Erreur lors de la notation.", variant: "destructive" });
        },
      }
    );
  };

  // Afficher le loader tant que ride n'est pas chargé
  if (!ride) {
    return (
      <MobileLayout role="passenger">
        <div className="flex h-full items-center justify-center pt-16">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </MobileLayout>
    );
  }

  // Définir les variables ici, après le return conditionnel mais avant le JSX
  const isBidding = ride.status === 'REQUESTED' || ride.status === 'BIDDING';
  const isActive = ['ASSIGNED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'IN_PROGRESS'].includes(ride.status);
  const isCompleted = ride.status === 'COMPLETED';

  const pickupCoords = { lat: parseFloat(ride.pickupLat as any), lng: parseFloat(ride.pickupLng as any) };
  const dropoffCoords = ride.dropLat ? { lat: parseFloat(ride.dropLat as any), lng: parseFloat(ride.dropLng as any) } : null;

  const offerDriverMarkers: DriverMarkerInfo[] = offers
    .filter((o: any) => o.location)
    .map((o: any) => ({
      lat: o.location.lat,
      lng: o.location.lng,
      name: o.driver?.name,
      phone: o.driver?.phone,
      vehicleType: o.profile?.vehicleType,
      rating: o.profile?.ratingAvg ? parseFloat(o.profile.ratingAvg) : undefined,
      ratingCount: o.profile?.ratingCount,
    }));

  const assignedDriverMarker: DriverMarkerInfo[] = [];
  if (isActive && assignedDriverLoc) {
    assignedDriverMarker.push({
      lat: assignedDriverLoc.lat,
      lng: assignedDriverLoc.lng,
      name: ride.driver?.name,
      phone: ride.driver?.phone,
      vehicleType: ride.vehicleType,
      isAssigned: true,
    });
  }

  const allDriverMarkers = [...offerDriverMarkers, ...assignedDriverMarker];

  const statusLabels: Record<string, { mg: string; fr: string; color: string }> = {
    REQUESTED: { mg: 'Mitady mpamily...', fr: 'Recherche de chauffeurs...', color: 'bg-amber-500/10 text-amber-600 border-amber-200' },
    BIDDING: { mg: 'Misy tolo-bidy', fr: 'Offres en cours', color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
    ASSIGNED: { mg: 'Voatendry ny mpamily', fr: 'Chauffeur assigné', color: 'bg-green-500/10 text-green-600 border-green-200' },
    DRIVER_EN_ROUTE: { mg: 'Eny an-dalana ny mpamily', fr: 'Chauffeur en route', color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
    DRIVER_ARRIVED: { mg: 'Tonga ny mpamily!', fr: 'Chauffeur arrivé!', color: 'bg-green-500/10 text-green-600 border-green-200' },
    IN_PROGRESS: { mg: 'Eny an-dalana...', fr: 'En cours...', color: 'bg-primary/10 text-primary border-primary/20' },
    COMPLETED: { mg: 'Vita ny dia', fr: 'Course terminée', color: 'bg-green-500/10 text-green-600 border-green-200' },
    CANCELED: { mg: 'Nofoanana', fr: 'Annulée', color: 'bg-red-500/10 text-red-600 border-red-200' },
  };

  const statusInfo = statusLabels[ride.status] || statusLabels.REQUESTED;

  return (
    <MobileLayout role="passenger">
      {/* Indicateur de connexion WebSocket */}
      <div className="absolute top-16 left-4 z-30">
        <div className={`px-2 py-1 rounded-full text-xs ${connected ? 'bg-green-500/20 text-green-700' : 'bg-red-500/20 text-red-700'}`}>
          {connected ? '● Connecté' : '○ Déconnecté'}
        </div>
      </div>

      {/* Publicité fermable */}
      {isActive && showAdBanner && (
        <div className="absolute top-14 left-0 right-0 z-20 px-3">
          <div className="relative bg-background/95 backdrop-blur-xl rounded-xl shadow-lg border">
            <Button
              variant="ghost"
              size="icon"
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background shadow-md z-10"
              onClick={() => setShowAdBanner(false)}
            >
              <X className="w-3 h-3" />
            </Button>
            <AdBanner position="RIDE_SCREEN" />
          </div>
        </div>
      )}
      
      <div className="absolute inset-0 z-0 pt-14">
        <MapView 
          center={pickupCoords}
          zoom={15}
          pickupMarker={pickupCoords}
          dropoffMarker={dropoffCoords}
          driverMarkers={allDriverMarkers}
          showRoute={true}
          interactive={true}
          routeCoordinates={routeCoords}
        />
      </div>

      <AnimatePresence>
        {isBidding && (
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="absolute bottom-0 w-full z-10 p-3 max-h-[65vh] flex flex-col"
          >
            <div className="bg-background/95 backdrop-blur-xl rounded-3xl shadow-float border-0 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-border/30 relative shrink-0">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className={`${statusInfo.color} px-2.5 py-0.5 text-xs font-bold`} data-testid="badge-status">
                    {lang === 'mg' ? statusInfo.mg : statusInfo.fr}
                  </Badge>
                  {viewsData && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1" data-testid="text-views">
                      <Eye className="w-3 h-3" /> {viewsData.viewCount} {lang === 'mg' ? 'mpamily nahita' : 'chauffeurs ont vu'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <MapPin className="w-3 h-3 text-green-500" />
                  <span className="truncate flex-1" data-testid="text-pickup-addr">{ride.pickupAddress}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3 text-red-500" />
                  <span className="truncate flex-1" data-testid="text-dropoff-addr">{ride.dropAddress}</span>
                </div>

                {(ride.distanceKm || ride.etaMinutes) && (
                  <div className="flex gap-2 mt-2">
                    {ride.distanceKm && (
                      <span className="text-xs bg-secondary/60 px-2 py-0.5 rounded-full flex items-center gap-1" data-testid="text-distance">
                        <Route className="w-3 h-3" /> {parseFloat(ride.distanceKm as any).toFixed(1)} km
                      </span>
                    )}
                    {ride.etaMinutes && (
                      <span className="text-xs bg-secondary/60 px-2 py-0.5 rounded-full flex items-center gap-1" data-testid="text-eta">
                        <Clock className="w-3 h-3" /> ~{ride.etaMinutes} min
                      </span>
                    )}
                  </div>
                )}

                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute right-3 top-3 text-muted-foreground hover:text-destructive"
                  onClick={() => cancelRide.mutate('Changed mind')}
                  data-testid="button-cancel-ride"
                >
                  <XCircle className="w-5 h-5" />
                </Button>
              </div>
              
              <div className="p-3 border-b border-border/30 shrink-0">
                <p className="text-xs font-bold text-muted-foreground">
                  {offers.length === 0 
                    ? (lang === 'mg' ? 'Miandry tolobidy...' : 'En attente d\'offres...')
                    : `${offers.length} ${lang === 'mg' ? 'tolobidy voaray' : 'offre(s) reçue(s)'}`
                  }
                </p>
              </div>

              <div className="overflow-y-auto p-3 space-y-2.5 shrink min-h-0">
                {offers.length === 0 ? (
                  <div className="py-6 text-center">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Navigation2 className="w-6 h-6 text-primary animate-pulse" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {lang === 'mg' ? 'Mitady mpamily akaiky...' : 'Recherche de chauffeurs à proximité...'}
                    </p>
                  </div>
                ) : (
                  offers.map((offer: any) => {
                    const rating = offer.profile?.ratingAvg ? parseFloat(offer.profile.ratingAvg) : 0;
                    const rCount = offer.profile?.ratingCount || 0;
                    const vType = offer.profile?.vehicleType || ride.vehicleType;
                    return (
                      <Card key={offer.id} className="p-3 rounded-2xl border border-border/50 hover:border-primary/50 transition-colors shadow-sm" data-testid={`offer-card-${offer.id}`}>
                        <div className="flex justify-between items-start mb-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-11 h-11 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full flex items-center justify-center relative">
                              <User className="w-5 h-5 text-primary" />
                              {offer.location && (
                                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white" title="En ligne" />
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-sm" data-testid={`text-driver-name-${offer.id}`}>{offer.driver?.name || 'Mpamily'}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {rating > 0 ? (
                                  <span className="flex items-center gap-0.5 font-semibold">
                                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                    <span className="text-amber-600 dark:text-amber-400">{rating.toFixed(1)}</span>
                                    <span className="text-muted-foreground/60">({rCount})</span>
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/60 italic">{lang === 'mg' ? 'Vaovao' : 'Nouveau'}</span>
                                )}
                                <span className="text-muted-foreground/30">•</span>
                                <span className="flex items-center gap-0.5">
                                  {vType === 'TAXI' ? <Car className="w-3 h-3" /> : <Bike className="w-3 h-3" />}
                                  {vType}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg font-display text-primary leading-tight" data-testid={`text-price-${offer.id}`}>
                              {offer.priceAr.toLocaleString()} <span className="text-xs">Ar</span>
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center justify-end gap-0.5">
                              <Clock className="w-3 h-3" /> {offer.etaMinutes} min
                            </p>
                          </div>
                        </div>

                        {offer.message && (
                          <p className="text-xs text-muted-foreground bg-secondary/40 rounded-lg px-2.5 py-1.5 mb-2.5 italic">
                            "{offer.message}"
                          </p>
                        )}

                        <div className="flex gap-2">
                          <Button 
                            onClick={() => acceptOffer.mutate(offer.id)}
                            disabled={acceptOffer.isPending}
                            className="flex-1 font-bold bg-foreground text-background hover:bg-foreground/90 rounded-xl h-9 text-sm"
                            data-testid={`button-accept-${offer.id}`}
                          >
                            {t('accept')}
                          </Button>
                          {offer.driver?.phone && (
                            <Button 
                              variant="outline"
                              size="icon"
                              className="rounded-xl h-9 w-9 shrink-0"
                              onClick={() => window.location.href = `tel:${offer.driver.phone}`}
                              data-testid={`button-call-${offer.id}`}
                            >
                              <Phone className="w-4 h-4 text-green-600" />
                            </Button>
                          )}
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
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            className="absolute bottom-0 w-full z-10 p-3"
          >
            <Card className="p-4 rounded-3xl shadow-float border-0 bg-background/95 backdrop-blur-xl">
              <div className="flex justify-between items-center mb-3">
                <Badge variant="outline" className={`${statusInfo.color} px-2.5 py-0.5 text-xs font-bold`} data-testid="badge-status">
                  {lang === 'mg' ? statusInfo.mg : statusInfo.fr}
                </Badge>
                <div className="font-display font-bold text-lg" data-testid="text-price">{ride.selectedPriceAr?.toLocaleString()} Ar</div>
              </div>

              {(ride.distanceKm || ride.etaMinutes) && (
                <div className="flex gap-2 mb-3">
                  {ride.distanceKm && (
                    <div className="flex items-center gap-1 text-xs bg-secondary/60 px-2 py-0.5 rounded-full" data-testid="text-distance">
                      <Route className="w-3 h-3" /> {parseFloat(ride.distanceKm as any).toFixed(1)} km
                    </div>
                  )}
                  {ride.etaMinutes && (
                    <div className="flex items-center gap-1 text-xs bg-secondary/60 px-2 py-0.5 rounded-full" data-testid="text-eta">
                      <Clock className="w-3 h-3" /> ~{ride.etaMinutes} min
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex items-center p-3 bg-secondary/50 rounded-2xl mb-3">
                <div className="w-11 h-11 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full flex items-center justify-center mr-3 relative">
                  <User className="w-5 h-5 text-primary" />
                  {assignedDriverLoc && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white animate-pulse" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm" data-testid="text-driver-name">{ride.driver?.name || 'Mpamily'}</h4>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{ride.vehicleType}</span>
                    {ride.driver?.phone && (
                      <>
                        <span className="text-muted-foreground/30">•</span>
                        <span>{ride.driver.phone}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button 
                    size="icon" 
                    variant="outline"
                    className="rounded-full w-9 h-9"
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: 'Ny diako - Farady',
                          text: `Mpamily: ${ride.driver?.name || 'Mpamily'}\nFinday: ${ride.driver?.phone || ''}\nFiara: ${ride.vehicleType}\nVidiny: ${ride.selectedPriceAr} Ar`,
                        }).catch(() => {});
                      } else {
                        toast({ title: "Zaraina ny dia", description: `Mpamily: ${ride.driver?.name}, ${ride.vehicleType}` });
                      }
                    }}
                    data-testid="button-share-trip"
                  >
                    <Share2 className="w-4 h-4" />
                  </Button>
                  <Button 
                    size="icon" 
                    className="rounded-full bg-green-500 text-white shadow-lg shadow-green-500/30 w-9 h-9"
                    onClick={() => window.location.href = `tel:${ride.driver?.phone || ''}`}
                    data-testid="button-call-driver"
                  >
                    <Phone className="w-4 h-4" />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="outline"
                    className="rounded-full w-9 h-9"
                    onClick={() => setShowChat(!showChat)}
                    data-testid="button-chat"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                {ride.status !== 'IN_PROGRESS' && (
                  <Button 
                    variant="destructive" 
                    onClick={() => cancelRide.mutate('Taking too long')}
                    className="flex-1 h-10 rounded-xl font-bold text-sm"
                    data-testid="button-cancel-ride"
                  >
                    {t('cancel')}
                  </Button>
                )}
                <Button 
                  variant="destructive"
                  onClick={() => setShowSOS(true)}
                  className="h-10 rounded-xl font-bold px-4 text-sm"
                  data-testid="button-sos"
                >
                  <ShieldAlert className="w-4 h-4 mr-1" /> SOS
                </Button>
              </div>
            </Card>
          </motion.div>
        )}

        {isCompleted && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            className="absolute bottom-0 w-full z-10 p-3"
          >
            <Card className="p-4 rounded-3xl shadow-float border-0 bg-background/95 backdrop-blur-xl">
              {hasRated ? (
                <div className="text-center py-6">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <h3 className="font-bold text-lg font-display mb-1">Misaotra anao!</h3>
                  <p className="text-sm text-muted-foreground">{lang === 'mg' ? 'Voaray ny naoty nomenao' : 'Note enregistrée'}</p>
                </div>
              ) : (
                <>
                  <div className="text-center mb-4">
                    <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
                    <h3 className="font-bold text-lg font-display">{lang === 'mg' ? 'Vita ny dia!' : 'Course terminée!'}</h3>
                    <p className="text-sm text-muted-foreground">{lang === 'mg' ? 'Omeo naoty ny mpamily' : 'Notez le chauffeur'}</p>
                  </div>

                  <div className="flex justify-center gap-2 mb-4" data-testid="rating-stars">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        data-testid={`star-${star}`}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setSelectedRating(star)}
                        className="p-1 transition-transform active:scale-110"
                      >
                        <Star
                          className={`w-8 h-8 transition-colors ${
                            star <= (hoverRating || selectedRating)
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-muted-foreground/30'
                          }`}
                        />
                      </button>
                    ))}
                  </div>

                  <Textarea
                    data-testid="input-rating-comment"
                    placeholder={lang === 'mg' ? "Hafatra fanampiny (tsy voatery)" : "Commentaire (optionnel)"}
                    value={ratingComment}
                    onChange={(e) => setRatingComment(e.target.value)}
                    className="mb-3 rounded-xl resize-none"
                    rows={2}
                  />

                  <Button
                    data-testid="button-submit-rating"
                    onClick={handleSubmitRating}
                    disabled={selectedRating === 0 || rateRide.isPending}
                    className="w-full font-bold bg-foreground text-background rounded-xl h-10"
                  >
                    {rateRide.isPending 
                      ? (lang === 'mg' ? 'Mandefitra...' : 'Envoi...') 
                      : (lang === 'mg' ? 'Alefaso ny naoty' : 'Envoyer la note')
                    }
                  </Button>
                </>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Box */}
      {showChat && rideId && currentUser && (
        <ChatBox
          rideId={rideId}
          currentUserId={currentUser.id}
          otherUserId={otherUserId}
          otherUserName={otherUserName}
          isOpen={showChat}
          onClose={() => setShowChat(false)}
        />
      )}

      <Dialog open={showSOS} onOpenChange={setShowSOS}>
        <DialogContent className="rounded-3xl sm:rounded-3xl border-0 shadow-2xl max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="text-red-600 font-display text-xl flex items-center gap-2">
              <ShieldAlert className="w-6 h-6" /> SOS - {lang === 'mg' ? 'Vonjy maika' : 'Urgence'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <a
              href="tel:117"
              className="flex items-center gap-3 p-3.5 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-900"
              data-testid="sos-police"
            >
              <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center text-white shrink-0">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-sm">Polisy - 117</p>
                <p className="text-xs text-muted-foreground">{lang === 'mg' ? 'Antso vonjy maika polisy' : 'Appel d\'urgence police'}</p>
              </div>
            </a>
            <a
              href="tel:118"
              className="flex items-center gap-3 p-3.5 bg-orange-50 dark:bg-orange-950/30 rounded-xl border border-orange-200 dark:border-orange-900"
              data-testid="sos-ambulance"
            >
              <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white shrink-0">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-sm">Ambulance - 118</p>
                <p className="text-xs text-muted-foreground">{lang === 'mg' ? 'Antso vonjy maika fahasalamana' : 'Appel d\'urgence médical'}</p>
              </div>
            </a>
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: 'SOS - Farady',
                    text: `${lang === 'mg' ? 'Mila vonjy aho!' : 'J\'ai besoin d\'aide!'} Mpamily: ${ride.driver?.name || ''}, Fiara: ${ride.vehicleType}, Avy: ${ride.pickupAddress}, Ho any: ${ride.dropAddress}`,
                  }).catch(() => {});
                }
                toast({ title: lang === 'mg' ? "Voazara ny toeranao" : "Position partagée" });
                setShowSOS(false);
              }}
              className="flex items-center gap-3 p-3.5 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-900 w-full text-left"
              data-testid="sos-share-location"
            >
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white shrink-0">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-sm">{lang === 'mg' ? 'Zarao ny toeranao' : 'Partager ma position'}</p>
                <p className="text-xs text-muted-foreground">{lang === 'mg' ? "Alefaso amin'ny namana na fianakaviana" : 'Envoyer à un proche'}</p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </MobileLayout>
  );
}