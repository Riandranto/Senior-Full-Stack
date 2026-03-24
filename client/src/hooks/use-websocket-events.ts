import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from './use-websocket';
import { useToast } from './use-toast';
import { useTranslation } from '@/lib/i18n';

export function useWebSocketEvents(userId?: number) {
  const { connected, subscribe } = useWebSocket();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { lang } = useTranslation();

  useEffect(() => {
    if (!connected || !userId) return;

    // Écouter les changements de statut des courses
    const unsubscribeRideStatus = subscribe('RIDE_STATUS_CHANGED', (data: any) => {
      if (data.driverId === userId || data.passengerId === userId) {
        // Rafraîchir les données
        queryClient.invalidateQueries({ queryKey: ['/api/driver/active-ride'] });
        queryClient.invalidateQueries({ queryKey: ['/api/rides/active'] });
        queryClient.invalidateQueries({ queryKey: ['/api/rides'] });
        
        // Afficher une notification
        if (data.status === 'ASSIGNED') {
          toast({
            title: lang === 'mg' ? "Dia vaovao!" : "Nouvelle course!",
            description: lang === 'mg' 
              ? "Nekena ny tolobidinao"
              : "Votre offre a été acceptée",
          });
        } else if (data.status === 'DRIVER_ARRIVED') {
          toast({
            title: lang === 'mg' ? "Tonga ny mpamily!" : "Chauffeur arrivé!",
            description: lang === 'mg' 
              ? "Miandrasa ny mpamily"
              : "Le chauffeur vous attend",
          });
        } else if (data.status === 'COMPLETED') {
          toast({
            title: lang === 'mg' ? "Vita ny dia!" : "Course terminée!",
            description: lang === 'mg' 
              ? "Misaotra nampiasa ny serivisy"
              : "Merci d'avoir utilisé notre service",
          });
        }
      }
    });

    // Écouter les nouvelles offres
    const unsubscribeNewOffer = subscribe('NEW_OFFER', (data: any) => {
      if (data.passengerId === userId) {
        queryClient.invalidateQueries({ queryKey: ['/api/rides', data.rideId, 'offers'] });
        toast({
          title: lang === 'mg' ? "Tolobidy vaovao!" : "Nouvelle offre!",
          description: lang === 'mg' 
            ? `Tolobidy ${data.priceAr} Ar avy amin'ny mpamily`
            : `Offre de ${data.priceAr} Ar d'un chauffeur`,
        });
      }
    });

    return () => {
      unsubscribeRideStatus();
      unsubscribeNewOffer();
    };
  }, [connected, userId, subscribe, queryClient, toast, lang]);
}