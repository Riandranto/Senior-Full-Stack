import React, { useState } from 'react';
import { MobileLayout } from '@/components/RoleLayout';
import { useTranslation } from '@/lib/i18n';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuery } from '@tanstack/react-query';
import { api } from '@shared/routes';
import { Clock, MapPin, Navigation, ChevronLeft, ChevronRight, Search, Star, Car, Bike, XCircle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const PAGE_SIZE = 10;

const statusColors: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  CANCELED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  ASSIGNED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  IN_PROGRESS: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  DRIVER_EN_ROUTE: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  DRIVER_ARRIVED: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
};

const statusIcons: Record<string, any> = {
  COMPLETED: CheckCircle,
  CANCELED: XCircle,
  ASSIGNED: Car,
  IN_PROGRESS: Car,
  DRIVER_EN_ROUTE: Car,
  DRIVER_ARRIVED: Car,
};

export default function HistoryPage() {
  const { t, lang } = useTranslation();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedRide, setSelectedRide] = useState<any>(null);

  const { data: rides = [], isLoading } = useQuery<any[]>({
    queryKey: [api.passenger.history.path],
    queryFn: async () => {
      const res = await fetch(api.passenger.history.path, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const filteredRides = rides.filter(ride => 
    search === '' || 
    ride.pickupAddress?.toLowerCase().includes(search.toLowerCase()) ||
    ride.dropAddress?.toLowerCase().includes(search.toLowerCase()) ||
    (ride.driver?.name?.toLowerCase().includes(search.toLowerCase()))
  );

  const totalPages = Math.max(1, Math.ceil(filteredRides.length / PAGE_SIZE));
  const paginatedRides = filteredRides.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const getStatusLabel = (status: string) => {
    const labels: Record<string, { mg: string; fr: string }> = {
      REQUESTED: { mg: 'Nangataka', fr: 'Demandé' },
      BIDDING: { mg: 'Tolo-bidy', fr: 'Enchères' },
      ASSIGNED: { mg: 'Voatendry', fr: 'Assigné' },
      DRIVER_EN_ROUTE: { mg: 'Eny an-dalana', fr: 'En route' },
      DRIVER_ARRIVED: { mg: 'Tonga', fr: 'Arrivé' },
      IN_PROGRESS: { mg: 'An-dalana', fr: 'En cours' },
      COMPLETED: { mg: 'Vita', fr: 'Terminé' },
      CANCELED: { mg: 'Nofoanana', fr: 'Annulé' },
    };
    return labels[status]?.[lang] || status;
  };

  if (isLoading) {
    return (
      <MobileLayout role="passenger">
        <div className="p-4 pt-20 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 bg-muted animate-pulse rounded-2xl" />
          ))}
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout role="passenger">
      <div className="p-4 pt-20 space-y-4">
        <h1 className="text-2xl font-bold font-display">{t('history')}</h1>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={lang === 'mg' ? 'Hikaroka adiresy na mpamily...' : 'Rechercher adresse ou chauffeur...'}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 rounded-xl"
          />
        </div>
        
        {paginatedRides.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
              <Clock className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">
              {lang === 'mg' ? 'Tsy mbola nisy dia natao.' : 'Aucune course effectuée.'}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {paginatedRides.map((ride, idx) => {
                const StatusIcon = statusIcons[ride.status] || Car;
                const isCompleted = ride.status === 'COMPLETED';
                const isCanceled = ride.status === 'CANCELED';
                
                return (
                  <motion.div
                    key={ride.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <Card 
                      className="p-4 rounded-2xl border-0 shadow-soft bg-card/50 backdrop-blur-sm cursor-pointer hover:shadow-md transition-all"
                      onClick={() => setSelectedRide(ride)}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {format(new Date(ride.createdAt), 'dd/MM/yyyy HH:mm')}
                        </div>
                        <div className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColors[ride.status] || 'bg-gray-100'}`}>
                          <StatusIcon className="w-3 h-3" />
                          {getStatusLabel(ride.status)}
                        </div>
                      </div>
                      
                      <div className="space-y-2 relative pl-4">
                        <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-muted"></div>
                        <div className="flex items-start">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 mr-2 shrink-0"></div>
                          <p className="text-sm font-medium line-clamp-1">{ride.pickupAddress}</p>
                        </div>
                        <div className="flex items-start">
                          <div className="w-1.5 h-1.5 rounded-sm bg-red-500 mt-1.5 mr-2 shrink-0"></div>
                          <p className="text-sm font-medium line-clamp-1">{ride.dropAddress}</p>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          {ride.driver && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Car className="w-3 h-3" />
                              {ride.driver.name}
                            </div>
                          )}
                          {ride.vehicleType && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              {ride.vehicleType === 'TAXI' ? <Car className="w-3 h-3" /> : <Bike className="w-3 h-3" />}
                              {ride.vehicleType}
                            </div>
                          )}
                        </div>
                        {ride.selectedPriceAr && (
                          <span className="font-bold text-primary">
                            {ride.selectedPriceAr.toLocaleString()} Ar
                          </span>
                        )}
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
            
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
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

      {/* Dialog Détails */}
      <Dialog open={!!selectedRide} onOpenChange={() => setSelectedRide(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">
              {lang === 'mg' ? 'Antsipirihan\'ny dia' : 'Détails de la course'}
            </DialogTitle>
          </DialogHeader>
          {selectedRide && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Badge className={statusColors[selectedRide.status]}>
                  {getStatusLabel(selectedRide.status)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  #{selectedRide.id}
                </span>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-xl">
                  <MapPin className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {lang === 'mg' ? 'Fiaingana' : 'Départ'}
                    </p>
                    <p className="text-sm font-medium">{selectedRide.pickupAddress}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-xl">
                  <Navigation className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {lang === 'mg' ? 'Fahatongavana' : 'Arrivée'}
                    </p>
                    <p className="text-sm font-medium">{selectedRide.dropAddress}</p>
                  </div>
                </div>
              </div>
              
              {selectedRide.driver && (
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <Car className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{selectedRide.driver.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedRide.driver.phone}
                    </p>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/30 rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground">
                    {lang === 'mg' ? 'Halavirana' : 'Distance'}
                  </p>
                  <p className="font-bold text-sm">
                    {selectedRide.distanceKm ? `${parseFloat(selectedRide.distanceKm).toFixed(1)} km` : '—'}
                  </p>
                </div>
                <div className="bg-muted/30 rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground">
                    {lang === 'mg' ? 'Fotoana' : 'Durée'}
                  </p>
                  <p className="font-bold text-sm">
                    {selectedRide.etaMinutes ? `${selectedRide.etaMinutes} min` : '—'}
                  </p>
                </div>
              </div>
              
              {selectedRide.selectedPriceAr && (
                <div className="bg-primary/10 rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground">
                    {lang === 'mg' ? 'Vidin-dalana' : 'Prix'}
                  </p>
                  <p className="font-bold text-lg text-primary">
                    {selectedRide.selectedPriceAr.toLocaleString()} Ar
                  </p>
                </div>
              )}
              
              {selectedRide.cancelReason && (
                <div className="bg-red-50 dark:bg-red-950/20 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">
                    {lang === 'mg' ? 'Antony fanafoanana' : 'Raison d\'annulation'}
                  </p>
                  <p className="text-sm">{selectedRide.cancelReason}</p>
                </div>
              )}
              
              <div className="text-center text-[10px] text-muted-foreground pt-2">
                {format(new Date(selectedRide.createdAt), 'dd/MM/yyyy HH:mm:ss')}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MobileLayout>
  );
}