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
    if (!connected || !userId) {
      console.log('WebSocket not ready or no userId:', { connected, userId });
      return;
    }

    console.log('🎧 Setting up WebSocket events for user:', userId);

    // Écouter les changements de statut des courses
    const unsubscribeRideStatus = subscribe('RIDE_STATUS_CHANGED', (data: any) => {
      console.log('🚗 RIDE_STATUS_CHANGED:', data);
      
      if (data.driverId === userId || data.passengerId === userId) {
        queryClient.invalidateQueries({ queryKey: ['/api/driver/active-ride'] });
        queryClient.invalidateQueries({ queryKey: ['/api/rides/active'] });
        queryClient.invalidateQueries({ queryKey: ['/api/driver/requests'] });
        
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

    // Écouter les offres acceptées
    const unsubscribeOfferAccepted = subscribe('OFFER_ACCEPTED', (data: any) => {
      console.log('💰 OFFER_ACCEPTED:', data);
      
      if (data.driverId === userId) {
        toast({
          title: lang === 'mg' ? "Nekena ny tolobidinao!" : "Offre acceptée!",
          description: lang === 'mg' 
            ? "Mandehana any amin'ny toerana fiaingana"
            : "Rendez-vous au point de départ",
        });
        
        // Recharger la course active immédiatement
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['/api/driver/active-ride'] });
          queryClient.invalidateQueries({ queryKey: ['/api/driver/requests'] });
        }, 500);
      }
      
      if (data.passengerId === userId) {
        toast({
          title: lang === 'mg' ? "Tolobidy voaray!" : "Offre acceptée!",
          description: lang === 'mg' 
            ? "Ho tonga ny mpamily"
            : "Le chauffeur arrive",
        });
        
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['/api/rides/active'] });
        }, 500);
      }
    });

    // Écouter les messages chat
    const unsubscribeChat = subscribe('CHAT_MESSAGE', (data: any) => {
      console.log('💬 CHAT_MESSAGE received in events:', data);
      
      if (data.toUserId === userId || data.from === userId) {
        // Recharger l'historique du chat
        queryClient.invalidateQueries({ queryKey: ['/api/chat/history', data.rideId] });
        
        toast({
          title: lang === 'mg' ? "Hafatra vaovao" : "Nouveau message",
          description: `${data.fromName}: ${data.message.substring(0, 50)}${data.message.length > 50 ? '...' : ''}`,
        });
      }
    });

    return () => {
      unsubscribeRideStatus();
      unsubscribeOfferAccepted();
      unsubscribeChat();
    };
  }, [connected, userId, subscribe, queryClient, toast, lang]);
}