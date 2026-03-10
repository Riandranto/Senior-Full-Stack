import { useState, useRef, useEffect, useCallback } from "react";
import { type WsMessage, WS_EVENTS } from "@shared/schema";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "./use-toast";
import { useTranslation } from "@/lib/i18n";
import { api } from "@shared/routes";

const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000; // 1 seconde

export function useWebSocket() {
  const [connected, setConnected] = useState(false); // <- C'est 'connected' qu'il faut utiliser
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout>();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { lang } = useTranslation();

  const connect = useCallback(() => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.error("Max WebSocket reconnection attempts reached");
      toast({
        variant: "destructive",
        title: lang === 'mg' ? "Tsy afaka mifandray" : "Connexion perdue",
        description: lang === 'mg'
          ? "Hamafiso ny tambajotra"
          : "Vérifiez votre connexion",
      });
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    if (wsRef.current) {
      wsRef.current.close();
    }

    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      setConnected(true);
      reconnectAttemptsRef.current = 0; // Réinitialiser les tentatives
      
      // Authentifier avec userId si disponible
      const user = queryClient.getQueryData([api.auth.me.path]) as any;
      if (user?.id) {
        wsRef.current?.send(JSON.stringify({
          type: 'auth',
          payload: { userId: user.id }
        }));
      }

      console.log("WebSocket connected");
    };

    wsRef.current.onclose = (event) => {
      setConnected(false);
      
      // Ne pas reconnecter si fermeture propre
      if (event.code === 1000 || event.code === 1001) {
        console.log("WebSocket closed cleanly");
        return;
      }

      // Tentative de reconnexion avec backoff exponentiel
      const delay = Math.min(
        BASE_RECONNECT_DELAY * Math.pow(1.5, reconnectAttemptsRef.current),
        30000 // Max 30 secondes
      );
      
      console.log(`WebSocket closed, reconnecting in ${delay}ms...`);
      
      reconnectTimerRef.current = setTimeout(() => {
        reconnectAttemptsRef.current++;
        connect();
      }, delay);
    };

    wsRef.current.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    wsRef.current.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as WsMessage;
        
        // Appeler les handlers
        const handlers = handlersRef.current.get(msg.type);
        if (handlers) {
          handlers.forEach(fn => fn(msg.payload));
        }
        
        // Auto-invalidation intelligente
        switch (msg.type) {
          case WS_EVENTS.RIDE_STATUS_CHANGED:
            queryClient.invalidateQueries({ 
              predicate: (query) => {
                const key = query.queryKey[0];
                return key === api.passenger.getRide.path || 
                       key === api.passenger.history.path ||
                       key === api.driver.getRequests.path;
              }
            });
            break;
            
          case WS_EVENTS.OFFER_NEW:
            queryClient.invalidateQueries({ 
              queryKey: [api.passenger.getOffers.path, msg.payload.rideId] 
            });
            break;
            
          case WS_EVENTS.OFFER_ACCEPTED:
            queryClient.invalidateQueries({ 
              queryKey: [api.passenger.getRide.path, msg.payload.id] 
            });
            queryClient.invalidateQueries({ 
              queryKey: [api.driver.getRequests.path] 
            });
            break;
            
          case WS_EVENTS.DRIVER_LOCATION:
            // Mettre à jour la position du conducteur dans le cache
            queryClient.setQueryData(
              ['/api/driver', msg.payload.driverId, 'location'],
              { lat: msg.payload.lat, lng: msg.payload.lng }
            );
            break;
        }
      } catch (err) {
        console.error("Failed to parse WS message", err);
      }
    };
  }, [queryClient, toast, lang]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounting");
      }
    };
  }, [connect]);

  const subscribe = useCallback((event: keyof typeof WS_EVENTS, handler: (data: any) => void) => {
    if (!handlersRef.current.has(event)) {
      handlersRef.current.set(event, new Set());
    }
    handlersRef.current.get(event)!.add(handler);

    return () => {
      handlersRef.current.get(event)?.delete(handler);
    };
  }, []);

  const emit = useCallback((type: keyof typeof WS_EVENTS, payload: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    } else {
      console.warn("WebSocket not connected, message not sent:", type);
    }
  }, []);

  return { 
    connected,  // <- C'est 'connected' qu'on retourne
    subscribe, 
    emit 
  };
}