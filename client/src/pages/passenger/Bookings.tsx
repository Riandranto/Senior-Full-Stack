// src/pages/passenger/Bookings.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { MobileLayout } from '@/components/RoleLayout';
import { useTranslation } from '@/lib/i18n';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, MapPin, Navigation, ChevronLeft, ChevronRight, Search, Calendar, Car, Bike, XCircle, CheckCircle, User, Loader2, Star, Phone, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useWebSocket } from '@/hooks/use-websocket';

const PAGE_SIZE = 10;

const bookingStatusColors: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  CONFIRMED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  ASSIGNED: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  IN_PROGRESS: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  CANCELED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const bookingStatusLabels: Record<string, { mg: string; fr: string }> = {
  PENDING: { mg: 'Miandry', fr: 'En attente' },
  CONFIRMED: { mg: 'Voatendry', fr: 'Confirmée' },
  ASSIGNED: { mg: 'Nekena', fr: 'Assignée' },
  IN_PROGRESS: { mg: 'An-dalana', fr: 'En cours' },
  COMPLETED: { mg: 'Vita', fr: 'Terminée' },
  CANCELED: { mg: 'Nofoanana', fr: 'Annulée' },
};

export default function BookingsPage() {
  const { lang } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { connected, subscribe } = useWebSocket();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [offersMap, setOffersMap] = useState<Map<number, any[]>>(new Map());

  // Ref pour stocker selectedBooking sans provoquer de réabonnement WebSocket
  const selectedBookingRef = useRef(selectedBooking);

  useEffect(() => {
    selectedBookingRef.current = selectedBooking;
  }, [selectedBooking]);

  // Requête principale des réservations avec polling conditionnel
  const { data: bookings = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['/api/bookings'],
    queryFn: async () => {
      const res = await apiFetch('/api/bookings', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: (query) => {
      if (document.visibilityState !== 'visible') return false;
      return 30000;
    },
    refetchIntervalInBackground: false,
  });

  // Récupération des offres pour la réservation sélectionnée
  const { data: fetchedOffers = [], refetch: refetchOffers } = useQuery<any[]>({
    queryKey: ['/api/bookings', selectedBooking?.id, 'offers'],
    queryFn: async () => {
      if (!selectedBooking) return [];
      const res = await apiFetch(`/api/bookings/${selectedBooking.id}/offers`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedBooking,
    refetchInterval: (query) => {
      if (document.visibilityState !== 'visible') return false;
      return 20000;
    },
    refetchIntervalInBackground: false,
  });

  // Fusion des offres WebSocket et API
  useEffect(() => {
    if (selectedBooking && fetchedOffers.length > 0) {
      setOffersMap(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(selectedBooking.id) || [];
        const merged = [...existing];
        fetchedOffers.forEach(offer => {
          if (!merged.some(o => o.id === offer.id)) {
            merged.push(offer);
          }
        });
        newMap.set(selectedBooking.id, merged);
        return newMap;
      });
    }
  }, [selectedBooking, fetchedOffers]);

  // WebSocket : écoute des nouvelles offres – souscrit une fois et utilise la ref
  useEffect(() => {
    if (!connected) return;

    const handleNewOffer = (data: any) => {
      console.log('Offre reçue via WebSocket:', data);
      const bookingId = data.bookingId || data.booking_id || data.reservationId;
      const driverName = data.driverName || data.driver_name || data.driver?.name || 'Chauffeur';
      const priceAr = data.priceAr || data.price || data.amount;
      const etaMinutes = data.etaMinutes || data.eta || data.eta_minutes || 10;
      const driverId = data.driverId || data.driver_id || data.driver?.id;
      const offerId = data.offerId || data.id || data.offer_id;

      if (!bookingId || !priceAr) {
        console.warn('Données d’offre incomplètes:', data);
        return;
      }

      setOffersMap(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(bookingId) || [];
        if (!existing.some(o => o.id === offerId)) {
          newMap.set(bookingId, [
            ...existing,
            {
              id: offerId,
              driver: { name: driverName, id: driverId },
              priceAr,
              etaMinutes,
              status: 'PENDING',
              createdAt: new Date().toISOString(),
            }
          ]);
        }
        return newMap;
      });

      // Utiliser la ref pour la réservation courante
      if (selectedBookingRef.current?.id === bookingId) {
        toast({
          title: lang === 'mg' ? "Tolobidy vaovao" : "Nouvelle offre",
          description: lang === 'mg' ? `Ny mpamily ${driverName} dia nanolotra ${priceAr} Ar` : `Le chauffeur ${driverName} a proposé ${priceAr} Ar`,
          className: "mobile-toast"
        });
        refetchOffers();
      } else {
        toast({
          title: lang === 'mg' ? "Tolobidy vaovao amin'ny reservation" : "Nouvelle offre sur une réservation",
          description: lang === 'mg' ? `Reservation #${bookingId} : ${driverName} nanolotra ${priceAr} Ar` : `Réservation #${bookingId} : ${driverName} a proposé ${priceAr} Ar`,
          className: "mobile-toast",
          duration: 5000,
        });
        refetch();
      }
    };

    const unsub = subscribe('booking_offer:new', handleNewOffer);
    return () => unsub();
  }, [connected, subscribe, refetch, refetchOffers, lang, toast]);

  // Mutation pour accepter une offre
  const acceptOffer = useMutation({
    mutationFn: async ({ bookingId, offerId }: { bookingId: number; offerId: number }) => {
      const res = await apiFetch(`/api/bookings/${bookingId}/offers/${offerId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to accept offer');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      setSelectedBooking(null);
      toast({
        title: lang === 'mg' ? "Tolobidy voaray!" : "Offre acceptée!",
        description: lang === 'mg' ? "Ny mpamily dia ho tonga ara-potoana." : "Le chauffeur arrivera à l'heure.",
        className: "mobile-toast"
      });
      if (data.rideId) {
        setTimeout(() => navigate(`/passenger/ride/${data.rideId}`), 1500);
      }
      setOffersMap(prev => {
        const newMap = new Map(prev);
        newMap.delete(data.bookingId);
        return newMap;
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

  const cancelBooking = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const res = await apiFetch(`/api/bookings/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to cancel');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      setShowCancelDialog(false);
      setCancelReason('');
      toast({
        title: lang === 'mg' ? "Reservation nofoanana" : "Réservation annulée",
        className: "mobile-toast"
      });
      setSelectedBooking(null);
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

  const filteredBookings = bookings.filter(booking => 
    search === '' || 
    booking.pickupAddress?.toLowerCase().includes(search.toLowerCase()) ||
    booking.dropAddress?.toLowerCase().includes(search.toLowerCase()) ||
    (booking.driver?.name?.toLowerCase().includes(search.toLowerCase()))
  );

  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / PAGE_SIZE));
  const paginatedBookings = filteredBookings.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const getStatusLabel = (status: string) => bookingStatusLabels[status]?.[lang] || status;
  const canCancel = (booking: any) => ['PENDING', 'CONFIRMED'].includes(booking.status);
  const handleAcceptOffer = (bookingId: number, offerId: number) => acceptOffer.mutate({ bookingId, offerId });

  const currentOffers = selectedBooking ? (offersMap.get(selectedBooking.id) || []) : [];

  if (isLoading) {
    return (
      <MobileLayout role="passenger">
        <div className="p-4 pt-20 space-y-3 pb-20">
          {[1, 2, 3].map(i => <div key={i} className="h-28 bg-muted animate-pulse rounded-2xl" />)}
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout role="passenger">
      <div className="p-4 pt-20 space-y-4 pb-24">
        <h1 className="text-2xl font-bold font-display flex items-center gap-2">
          <Calendar className="w-6 h-6 text-primary" />
          {lang === 'mg' ? 'Reservation' : 'Réservations'}
        </h1>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={lang === 'mg' ? 'Hikaroka adiresy...' : 'Rechercher adresse...'}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 rounded-xl"
          />
        </div>
        
        {paginatedBookings.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">
              {lang === 'mg' ? 'Tsy mbola nisy reservation natao.' : 'Aucune réservation effectuée.'}
            </p>
            <Button variant="outline" className="mt-4 rounded-xl" onClick={() => window.location.href = '/passenger'}>
              {lang === 'mg' ? 'Mangataka fotoana' : 'Réserver un trajet'}
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto pb-4">
              {paginatedBookings.map((booking, idx) => (
                <motion.div key={booking.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
                  <Card className="p-4 rounded-2xl border-0 bg-card/50 backdrop-blur-sm cursor-pointer hover:shadow-md transition-all" onClick={() => setSelectedBooking(booking)}>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(booking.scheduledFor), 'dd/MM/yyyy HH:mm')}
                      </div>
                      <div className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${bookingStatusColors[booking.status]}`}>
                        {getStatusLabel(booking.status)}
                        {offersMap.get(booking.id)?.length > 0 && booking.status === 'PENDING' && (
                          <span className="ml-1 bg-red-500 text-white rounded-full w-4 h-4 text-[9px] inline-flex items-center justify-center">
                            {offersMap.get(booking.id)!.length}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2 relative pl-4">
                      <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-muted"></div>
                      <div className="flex items-start">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 mr-2 shrink-0"></div>
                        <p className="text-sm font-medium line-clamp-1">{booking.pickupAddress}</p>
                      </div>
                      <div className="flex items-start">
                        <div className="w-1.5 h-1.5 rounded-sm bg-red-500 mt-1.5 mr-2 shrink-0"></div>
                        <p className="text-sm font-medium line-clamp-1">{booking.dropAddress}</p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        {booking.driver && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <User className="w-3 h-3" /> {booking.driver.name}
                          </div>
                        )}
                        {booking.vehicleType && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            {booking.vehicleType === 'TAXI' ? <Car className="w-3 h-3" /> : <Bike className="w-3 h-3" />}
                            {booking.vehicleType}
                          </div>
                        )}
                      </div>
                      {booking.finalPriceAr ? (
                        <span className="font-bold text-primary">{booking.finalPriceAr.toLocaleString()} Ar</span>
                      ) : booking.estimatedPriceAr && (
                        <span className="font-bold text-primary">{booking.estimatedPriceAr.toLocaleString()} Ar</span>
                      )}
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="fixed bottom-16 left-0 right-0 bg-background/95 backdrop-blur-xl border-t border-border/30 py-3 px-4 flex items-center justify-between z-10">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded-xl">
                  <ChevronLeft className="w-4 h-4 mr-1" /> {lang === 'mg' ? 'Teo aloha' : 'Précédent'}
                </Button>
                <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-xl">
                  {lang === 'mg' ? 'Manaraka' : 'Suivant'} <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={!!selectedBooking} onOpenChange={(open) => { if (!open) setSelectedBooking(null); }}>
        <DialogContent className="max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {lang === 'mg' ? 'Antsipirihan\'ny reservation' : 'Détails de la réservation'}
            </DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Badge className={bookingStatusColors[selectedBooking.status]}>{getStatusLabel(selectedBooking.status)}</Badge>
                <span className="text-xs text-muted-foreground">#{selectedBooking.id}</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-xl">
                  <MapPin className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <div><p className="text-xs text-muted-foreground">{lang === 'mg' ? 'Fiaingana' : 'Départ'}</p><p className="text-sm font-medium">{selectedBooking.pickupAddress}</p></div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-xl">
                  <Navigation className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <div><p className="text-xs text-muted-foreground">{lang === 'mg' ? 'Fahatongavana' : 'Arrivée'}</p><p className="text-sm font-medium">{selectedBooking.dropAddress}</p></div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-xl">
                <Calendar className="w-4 h-4 text-primary" />
                <div><p className="text-xs text-muted-foreground">{lang === 'mg' ? 'Daty sy ora' : 'Date et heure'}</p><p className="font-medium text-sm">{format(new Date(selectedBooking.scheduledFor), 'dd/MM/yyyy HH:mm')}</p></div>
              </div>

              {/* Offres */}
              {currentOffers.length > 0 ? (
                <div>
                  <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center justify-between">
                    <span>{lang === 'mg' ? 'Tolobidy avy amin\'ny mpamily' : 'Offres des chauffeurs'} ({currentOffers.length})</span>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => refetchOffers()}>
                      <RefreshCw className="w-3 h-3 mr-1" /> {lang === 'mg' ? 'Vaovao' : 'Rafraîchir'}
                    </Button>
                  </p>
                  <div className="space-y-3">
                    {currentOffers.map((offer: any) => (
                      <Card key={offer.id} className="p-3 rounded-xl border border-border/50">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center"><Car className="w-4 h-4 text-primary" /></div>
                              <p className="font-bold text-sm">{offer.driver?.name || 'Mpamily'}</p>
                            </div>
                            {offer.driver?.phone && <a href={`tel:${offer.driver.phone}`} className="text-xs text-primary flex items-center gap-1 mt-1"><Phone className="w-3 h-3" />{offer.driver.phone}</a>}
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg text-primary">{offer.priceAr.toLocaleString()} <span className="text-xs">Ar</span></p>
                            <p className="text-xs text-muted-foreground flex items-center justify-end gap-0.5"><Clock className="w-3 h-3" /> {offer.etaMinutes} min</p>
                          </div>
                        </div>
                        {offer.message && <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-2 py-1 mb-2 italic">"{offer.message}"</p>}
                        {selectedBooking.status === 'PENDING' && (
                          <Button size="sm" className="w-full mt-2 font-bold rounded-xl bg-gradient-to-r from-primary to-primary/80" onClick={() => handleAcceptOffer(selectedBooking.id, offer.id)} disabled={acceptOffer.isPending}>
                            {acceptOffer.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (lang === 'mg' ? 'Manaiky ity tolobidy ity' : 'Accepter cette offre')}
                          </Button>
                        )}
                      </Card>
                    ))}
                  </div>
                </div>
              ) : selectedBooking.status === 'PENDING' ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  {lang === 'mg' ? 'Tsy mbola misy tolo-bidy. Miandrasa...' : 'Aucune offre pour le moment. En attente...'}
                  <Button variant="ghost" size="sm" className="ml-2 h-6 px-2" onClick={() => refetchOffers()}>
                    <RefreshCw className="w-3 h-3 mr-1" /> {lang === 'mg' ? 'Havaozy' : 'Rafraîchir'}
                  </Button>
                </div>
              ) : null}
              
              {selectedBooking.driver && currentOffers.length === 0 && (
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center"><Car className="w-5 h-5 text-primary" /></div>
                  <div><p className="font-bold text-sm">{selectedBooking.driver.name}</p><p className="text-xs text-muted-foreground">{selectedBooking.driver.phone}</p></div>
                </div>
              )}
              
              {selectedBooking.cancelReason && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-xl">
                  <p className="text-xs text-red-600 font-bold mb-1">{lang === 'mg' ? 'Antony fanafoanana' : 'Raison d\'annulation'}</p>
                  <p className="text-sm">{selectedBooking.cancelReason}</p>
                </div>
              )}
              
              {canCancel(selectedBooking) && (
                <Button variant="destructive" className="w-full" onClick={() => setShowCancelDialog(true)}>
                  <XCircle className="w-4 h-4 mr-2" /> {lang === 'mg' ? 'Mamafa ny reservation' : 'Annuler la réservation'}
                </Button>
              )}
              
              <div className="text-center text-[10px] text-muted-foreground pt-2">
                {lang === 'mg' ? 'Noforonina' : 'Créée'} {format(new Date(selectedBooking.createdAt), 'dd/MM/yyyy HH:mm:ss')}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader><DialogTitle className="text-red-600">{lang === 'mg' ? 'Mamafa ny reservation' : 'Annuler la réservation'}</DialogTitle></DialogHeader>
          <Input placeholder={lang === 'mg' ? 'Antony fanafoanana (tsara raha fenoina)' : 'Raison (recommandé)'} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="rounded-xl" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>{lang === 'mg' ? 'Hiverina' : 'Retour'}</Button>
            <Button variant="destructive" onClick={() => selectedBooking && cancelBooking.mutate({ id: selectedBooking.id, reason: cancelReason })} disabled={cancelBooking.isPending}>
              {cancelBooking.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (lang === 'mg' ? 'Hamafa' : 'Annuler')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MobileLayout>
  );
}