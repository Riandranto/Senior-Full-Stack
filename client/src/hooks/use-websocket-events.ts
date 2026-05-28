import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from './use-websocket';
import { useToast } from './use-toast';
import { useTranslation } from '@/lib/i18n';

export function useWebSocketEvents(userId?: number, role?: string) {
  const { subscribe, connected } = useWebSocket();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { lang } = useTranslation();

  const hasSubscribed = useRef(false);
  const userIdRef = useRef(userId);
  const roleRef = useRef(role);
  const toastRef = useRef(toast);
  const langRef = useRef(lang);
  const queryClientRef = useRef(queryClient);

  useEffect(() => {
    userIdRef.current = userId;
    roleRef.current = role;
    toastRef.current = toast;
    langRef.current = lang;
    queryClientRef.current = queryClient;
  }, [userId, role, toast, lang, queryClient]);

  useEffect(() => {
    if (!connected || hasSubscribed.current) return;
    hasSubscribed.current = true;

    console.log('🎧 WebSocketEventManager subscribed once', userIdRef.current, roleRef.current);

    const unsubRideStatus = subscribe('RIDE_STATUS_CHANGED', (data) => {
      const uid = userIdRef.current;
      const r = roleRef.current;
      const qc = queryClientRef.current;
      const t = toastRef.current;
      const l = langRef.current;
      if (data.driverId !== uid && data.passengerId !== uid) return;
      if (r === 'DRIVER') {
        qc.invalidateQueries({ queryKey: ['/api/driver/active-ride'] });
        qc.invalidateQueries({ queryKey: ['/api/driver/requests'] });
      }
      if (r === 'PASSENGER') {
        qc.invalidateQueries({ queryKey: ['/api/rides/active'] });
      }
      if (data.status === 'ASSIGNED' && r === 'DRIVER') {
        t({ title: l === 'mg' ? "Dia vaovao!" : "Nouvelle course!" });
      } else if (data.status === 'DRIVER_ARRIVED' && r === 'PASSENGER') {
        t({ title: l === 'mg' ? "Tonga ny mpamily!" : "Chauffeur arrivé!" });
      } else if (data.status === 'COMPLETED') {
        t({ title: l === 'mg' ? "Vita ny dia!" : "Course terminée!" });
      }
    });

    const unsubOfferAccepted = subscribe('OFFER_ACCEPTED', (data) => {
      const uid = userIdRef.current;
      const r = roleRef.current;
      const qc = queryClientRef.current;
      const t = toastRef.current;
      const l = langRef.current;
      if (data.driverId === uid && r === 'DRIVER') {
        t({ title: l === 'mg' ? "Nekena ny tolobidinao!" : "Offre acceptée!" });
        setTimeout(() => {
          qc.invalidateQueries({ queryKey: ['/api/driver/active-ride'] });
          qc.invalidateQueries({ queryKey: ['/api/driver/requests'] });
        }, 500);
      }
      if (data.passengerId === uid && r === 'PASSENGER') {
        t({ title: l === 'mg' ? "Tolobidy voaray!" : "Offre acceptée!" });
        setTimeout(() => qc.invalidateQueries({ queryKey: ['/api/rides/active'] }), 500);
      }
    });

    const unsubOfferExpired = subscribe('OFFER_EXPIRED', (data) => {
      const uid = userIdRef.current;
      const r = roleRef.current;
      const qc = queryClientRef.current;
      const t = toastRef.current;
      const l = langRef.current;
      if (data.driverId === uid && r === 'DRIVER') {
        t({ title: l === 'mg' ? "Lany daty ny tolo-bidy" : "Offre expirée" });
        qc.invalidateQueries({ queryKey: ['/api/driver/requests'] });
      }
      if (data.passengerId === uid && r === 'PASSENGER') {
        t({ title: l === 'mg' ? "Lany daty ny tolo-bidy" : "Offre expirée" });
        qc.invalidateQueries({ queryKey: ['/api/passenger/offers', data.rideId] });
      }
    });

    const unsubChat = subscribe('CHAT_MESSAGE', (data) => {
      const uid = userIdRef.current;
      const qc = queryClientRef.current;
      const t = toastRef.current;
      const l = langRef.current;
      if (data.toUserId !== uid && data.from !== uid) return;
      qc.invalidateQueries({ queryKey: ['/api/chat/history', data.rideId] });
      t({
        title: l === 'mg' ? "Hafatra vaovao" : "Nouveau message",
        description: `${data.fromName}: ${data.message.substring(0, 50)}${data.message.length > 50 ? '...' : ''}`,
      });
    });

    const unsubBookingOfferExpired = subscribe('BOOKING_OFFER_EXPIRED', (data) => {
      const uid = userIdRef.current;
      const r = roleRef.current;
      const qc = queryClientRef.current;
      const t = toastRef.current;
      const l = langRef.current;
      if (data.driverId === uid && r === 'DRIVER') {
        t({ title: l === 'mg' ? "Lany daty ny tolo-bidy reservation" : "Offre de réservation expirée" });
        qc.invalidateQueries({ queryKey: ['/api/driver/bookings'] });
      }
      if (data.passengerId === uid && r === 'PASSENGER') {
        t({ title: l === 'mg' ? "Lany daty ny tolo-bidy reservation" : "Offre de réservation expirée" });
        qc.invalidateQueries({ queryKey: ['/api/bookings', data.bookingId, 'offers'] });
      }
    });

    const unsubBookingNewOffer = subscribe('BOOKING_NEW_OFFER', (data) => {
      const uid = userIdRef.current;
      const r = roleRef.current;
      const t = toastRef.current;
      const l = langRef.current;
      const qc = queryClientRef.current;
      if (r === 'PASSENGER') {
        t({
          title: l === 'mg' ? "Tolobidy vaovao" : "Nouvelle offre",
          description: l === 'mg' ? `Tolobidy ho an'ny reservation #${data.bookingId}` : `Offre pour la réservation #${data.bookingId}`,
          duration: 5000,
        });
        qc.invalidateQueries({ queryKey: ['/api/bookings', data.bookingId, 'offers'] });
      }
    });

    const unsubBookingNew = subscribe('BOOKING_NEW', (data) => {
      const uid = userIdRef.current;
      const r = roleRef.current;
      const t = toastRef.current;
      const l = langRef.current;
      const qc = queryClientRef.current;
      if (r === 'DRIVER' && data.driverId !== uid) {
        t({
          title: l === 'mg' ? "Reservation vaovao!" : "Nouvelle réservation!",
          description: l === 'mg' ? `Le ${new Date(data.scheduledFor).toLocaleDateString()}` : `Le ${new Date(data.scheduledFor).toLocaleDateString()}`,
        });
        qc.invalidateQueries({ queryKey: ['/api/driver/bookings'] });
      }
    });

    const unsubBookingOfferAccepted = subscribe('BOOKING_OFFER_ACCEPTED', (data) => {
      const uid = userIdRef.current;
      const r = roleRef.current;
      const t = toastRef.current;
      const l = langRef.current;
      const qc = queryClientRef.current;
      if (r === 'DRIVER' && data.driverId === uid) {
        t({ title: l === 'mg' ? "Tolobidy nekena!" : "Offre de réservation acceptée!" });
        qc.invalidateQueries({ queryKey: ['/api/driver/bookings'] });
        qc.invalidateQueries({ queryKey: ['/api/driver/active-ride'] });
      }
      if (r === 'PASSENGER' && data.passengerId === uid) {
        t({ title: l === 'mg' ? "Tolobidy reservation nekena!" : "Offre de réservation acceptée!" });
        qc.invalidateQueries({ queryKey: ['/api/bookings'] });
      }
    });

    const unsubDriverLocation = subscribe('DRIVER_LOCATION', (data) => {
      const uid = userIdRef.current;
      const r = roleRef.current;
      const qc = queryClientRef.current;
      if (r === 'PASSENGER' && data.rideId) {
        qc.invalidateQueries({ queryKey: ['/api/rides', data.rideId] });
      }
    });

    return () => {
      unsubRideStatus();
      unsubOfferAccepted();
      unsubOfferExpired();
      unsubChat();
      unsubBookingOfferExpired();
      unsubBookingNewOffer();
      unsubBookingNew();
      unsubBookingOfferAccepted();
      unsubDriverLocation();
      hasSubscribed.current = false;
    };
  }, [connected, subscribe]);
}