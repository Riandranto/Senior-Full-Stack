import React from 'react';
import { MobileLayout } from '@/components/RoleLayout';
import { useTranslation } from '@/lib/i18n';
import { Card } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { api } from '@shared/routes';
import { Clock, MapPin, Navigation, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { type Ride } from '@shared/schema';

export default function HistoryPage() {
  const { t } = useTranslation();
  const { data: rides = [], isLoading } = useQuery<Ride[]>({
    queryKey: ['/api/rides'],
  });

  return (
    <MobileLayout role="passenger">
      <div className="p-4 pt-20 space-y-4">
        <h1 className="text-2xl font-bold font-display">{t('history')}</h1>
        
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-2xl" />)}
          </div>
        ) : rides.length === 0 ? (
          <p className="text-center py-10 text-muted-foreground italic">Tsy mbola nisy dia natao.</p>
        ) : (
          rides.map((ride: any) => (
            <Card key={ride.id} className="p-4 rounded-2xl border-0 shadow-soft bg-card/50 backdrop-blur-sm">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center text-xs text-muted-foreground">
                  <Clock className="w-3 h-3 mr-1" />
                  {format(new Date(ride.createdAt), 'dd/MM/yyyy HH:mm')}
                </div>
                <div className="bg-primary/20 text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  {ride.status}
                </div>
              </div>
              
              <div className="space-y-2 relative pl-4">
                <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-muted"></div>
                <div className="flex items-start">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 mr-2 shrink-0"></div>
                  <p className="text-sm font-medium line-clamp-1">{ride.pickupAddress}</p>
                </div>
                <div className="flex items-start">
                  <div className="w-1.5 h-1.5 rounded-sm bg-foreground mt-1.5 mr-2 shrink-0"></div>
                  <p className="text-sm font-medium line-clamp-1">{ride.dropAddress}</p>
                </div>
              </div>

              {ride.selectedPriceAr && (
                <div className="mt-3 pt-3 border-t flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Vidin-dalana</span>
                  <span className="font-bold text-primary">{ride.selectedPriceAr} Ar</span>
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </MobileLayout>
  );
}
