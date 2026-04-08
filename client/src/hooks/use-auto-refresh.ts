// use-auto-refresh.ts - Version corrigée
import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface UseAutoRefreshOptions {
  queryKeys: string[][];
  interval?: number;
  enabled?: boolean;
}

export function useAutoRefresh({ queryKeys, interval = 10000, enabled = true }: UseAutoRefreshOptions) {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout>();
  const timeoutRef = useRef<NodeJS.Timeout>();

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setIsRefreshing(true);
    try {
      await Promise.all(
        queryKeys.map(key => queryClient.invalidateQueries({ queryKey: key }))
      );
    } catch (error) {
      console.error('Erreur lors du rafraîchissement:', error);
    } finally {
      // Garder l'indicateur visible un peu plus longtemps
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setIsRefreshing(false), 800);
    }
  }, [queryClient, queryKeys, enabled]);

  useEffect(() => {
    if (enabled) {
      intervalRef.current = setInterval(refresh, interval);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [refresh, interval, enabled]);

  return { refresh, isRefreshing };
}