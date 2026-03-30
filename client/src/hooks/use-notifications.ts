// src/hooks/use-notifications.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from './use-websocket';
import { useToast } from './use-toast';
import { useTranslation } from '@/lib/i18n';
import { apiFetch } from '@/lib/api';
import { useEffect } from 'react';

export interface Notification {
  id: number;
  userId: number;
  title: string;
  message: string;
  type: string;
  rideId?: number;
  isRead: boolean;
  createdAt: string;
}

export function useNotifications() {
  const { connected, subscribe } = useWebSocket();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { lang } = useTranslation();

  const { data: notifications = [], refetch } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    queryFn: async () => {
      const res = await apiFetch('/api/notifications', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 10000,
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['/api/notifications/unread-count'],
    queryFn: async () => {
      const res = await apiFetch('/api/notifications/unread-count', { credentials: 'include' });
      if (!res.ok) return { count: 0 };
      const data = await res.json();
      return data.count;
    },
    refetchInterval: 5000,
  });

  // Écouter les notifications WebSocket
  useEffect(() => {
    if (!connected) return;
    
    const unsubscribe = subscribe('NOTIFICATION', (payload: Notification) => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
      
      // Afficher un toast pour les notifications importantes
      if (payload.type === 'OFFER_ACCEPTED' || payload.type === 'OFFER_NEW') {
        toast({
          title: payload.title,
          description: payload.message,
          duration: 5000,
        });
      }
    });
    
    return () => unsubscribe();
  }, [connected, queryClient, toast]);

  const markAsRead = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/notifications/${id}/read`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to mark as read');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const res = await apiFetch('/api/notifications/read-all', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to mark all as read');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    },
  });

  return {
    notifications,
    unreadCount,
    markAsRead: markAsRead.mutate,
    markAllAsRead: markAllAsRead.mutate,
    refetch,
    isLoading: false,
  };
}