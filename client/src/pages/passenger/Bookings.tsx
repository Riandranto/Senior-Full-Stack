// src/pages/passenger/Bookings.tsx (version corrigée)
import React, { useState } from 'react';
import { MobileLayout } from '@/components/RoleLayout';
import { useTranslation } from '@/lib/i18n';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, MapPin, Navigation, ChevronLeft, ChevronRight, Search, Calendar, Car, Bike, XCircle, CheckCircle, User, Loader2, Play } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

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
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const { data: bookings = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['/api/bookings'],
    queryFn: async () => {
      const res = await apiFetch('/api/bookings', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
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
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: lang === 'mg' ? "Tsy nety" : "Erreur",
        description: error.message,
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

  const getStatusLabel = (status: string) => {
    return bookingStatusLabels[status]?.[lang] || status;
  };

  const canCancel = (booking: any) => {
    return ['PENDING', 'CONFIRMED', 'ASSIGNED'].includes(booking.status);
  };

  if (isLoading) {
    return (
      <MobileLayout role="passenger">
        <div className="p-4 pt-20 space-y-3 pb-20">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 bg-muted animate-pulse rounded-2xl" />
          ))}
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
            <Button 
              variant="outline" 
              className="mt-4 rounded-xl"
              onClick={() => window.location.href = '/passenger'}
            >
              {lang === 'mg' ? 'Mangataka fotoana' : 'Réserver un trajet'}
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto pb-4">
              {paginatedBookings.map((booking, idx) => (
                <motion.div
                  key={booking.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card 
                    className="p-4 rounded-2xl border-0 shadow-soft bg-card/50 backdrop-blur-sm cursor-pointer hover:shadow-md transition-all"
                    onClick={() => setSelectedBooking(booking)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(booking.scheduledFor), 'dd/MM/yyyy HH:mm')}
                      </div>
                      <div className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${bookingStatusColors[booking.status]}`}>
                        {getStatusLabel(booking.status)}
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
                            <User className="w-3 h-3" />
                            {booking.driver.name}
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
                        <span className="font-bold text-primary">
                          {booking.finalPriceAr.toLocaleString()} Ar
                        </span>
                      ) : booking.estimatedPriceAr && (
                        <span className="font-bold text-primary">
                          {booking.estimatedPriceAr.toLocaleString()} Ar
                        </span>
                      )}
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
            
            {totalPages > 1 && (
              <div className="fixed bottom-16 left-0 right-0 bg-background/95 backdrop-blur-xl border-t border-border/30 py-3 px-4 flex items-center justify-between z-10">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-xl"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  {lang === 'mg' ? 'Teo aloha' : 'Précédent'}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded-xl"
                >
                  {lang === 'mg' ? 'Manaraka' : 'Suivant'}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Dialog Détails Réservation */}
      <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
        <DialogContent className="max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {lang === 'mg' ? 'Antsipirihan\'ny reservation' : 'Détails de la réservation'}
            </DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Badge className={bookingStatusColors[selectedBooking.status]}>
                  {getStatusLabel(selectedBooking.status)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  #{selectedBooking.id}
                </span>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-xl">
                  <MapPin className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {lang === 'mg' ? 'Fiaingana' : 'Départ'}
                    </p>
                    <p className="text-sm font-medium">{selectedBooking.pickupAddress}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-xl">
                  <Navigation className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {lang === 'mg' ? 'Fahatongavana' : 'Arrivée'}
                    </p>
                    <p className="text-sm font-medium">{selectedBooking.dropAddress}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-xl">
                <Calendar className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">
                    {lang === 'mg' ? 'Daty sy ora' : 'Date et heure'}
                  </p>
                  <p className="font-medium text-sm">
                    {format(new Date(selectedBooking.scheduledFor), 'dd/MM/yyyy HH:mm')}
                  </p>
                </div>
              </div>
              
              {selectedBooking.driver && (
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <Car className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{selectedBooking.driver.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedBooking.driver.phone}
                    </p>
                  </div>
                </div>
              )}
              
              {selectedBooking.offers && selectedBooking.offers.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-muted-foreground mb-2">
                    {lang === 'mg' ? 'Tolobidy voaray' : 'Offres reçues'} ({selectedBooking.offers.length})
                  </p>
                  <div className="space-y-2">
                    {selectedBooking.offers.map((offer: any) => (
                      <div key={offer.id} className="p-2 bg-muted/20 rounded-lg flex justify-between items-center">
                        <div>
                          <p className="text-xs font-medium">{offer.driver?.name}</p>
                          <p className="text-[10px] text-muted-foreground">{offer.etaMinutes} min</p>
                        </div>
                        <div>
                          <span className="font-bold text-sm">{offer.priceAr.toLocaleString()} Ar</span>
                          <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded ${
                            offer.status === 'ACCEPTED' ? 'bg-green-100 text-green-700' :
                            offer.status === 'EXPIRED' ? 'bg-gray-100 text-gray-600' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {offer.status === 'ACCEPTED' ? (lang === 'mg' ? 'Nekena' : 'Acceptée') :
                             offer.status === 'EXPIRED' ? (lang === 'mg' ? 'Lany daty' : 'Expirée') :
                             (lang === 'mg' ? 'Nalefa' : 'Envoyée')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {selectedBooking.cancelReason && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-xl">
                  <p className="text-xs text-red-600 font-bold mb-1">
                    {lang === 'mg' ? 'Antony fanafoanana' : 'Raison d\'annulation'}
                  </p>
                  <p className="text-sm">{selectedBooking.cancelReason}</p>
                </div>
              )}
              
              {canCancel(selectedBooking) && (
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => {
                    setShowCancelDialog(true);
                  }}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  {lang === 'mg' ? 'Mamafa ny reservation' : 'Annuler la réservation'}
                </Button>
              )}
              
              <div className="text-center text-[10px] text-muted-foreground pt-2">
                {lang === 'mg' ? 'Noforonina' : 'Créée'} {format(new Date(selectedBooking.createdAt), 'dd/MM/yyyy HH:mm:ss')}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog d'annulation */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-red-600">
              {lang === 'mg' ? 'Mamafa ny reservation' : 'Annuler la réservation'}
            </DialogTitle>
          </DialogHeader>
          <Input
            placeholder={lang === 'mg' ? 'Antony fanafoanana (tsara raha fenoina)' : 'Raison (recommandé)'}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            className="rounded-xl"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              {lang === 'mg' ? 'Hiverina' : 'Retour'}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedBooking) {
                  cancelBooking.mutate({ id: selectedBooking.id, reason: cancelReason });
                }
              }}
              disabled={cancelBooking.isPending}
            >
              {cancelBooking.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                lang === 'mg' ? 'Hamafa' : 'Annuler'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MobileLayout>
  );
}