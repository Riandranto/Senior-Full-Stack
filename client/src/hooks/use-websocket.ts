// src/hooks/use-websocket.ts
import { useState, useRef, useEffect, useCallback } from "react";
import { type WsMessage, WS_EVENTS } from "@shared/schema";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "./use-toast";
import { useTranslation } from "@/lib/i18n";
import { api } from "@shared/routes";

const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000;

export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout>();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { lang } = useTranslation();

  const getWebSocketUrl = useCallback(() => {
    // En production (deployed on Railway)
    if (import.meta.env.PROD) {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      return `${protocol}//${host}/ws`;
    }
    
    // En développement
    return 'ws://localhost:5000/ws';
  }, []);

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

    const wsUrl = getWebSocketUrl();
    console.log(`🔌 WebSocket connecting to: ${wsUrl}`);
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }

    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log("✅ WebSocket connected");
      setConnected(true);
      reconnectAttemptsRef.current = 0;
      
      // Authentifier après connexion
      const user = queryClient.getQueryData([api.auth.me.path]) as any;
      if (user?.id) {
        wsRef.current?.send(JSON.stringify({
          type: 'auth',
          payload: { userId: user.id }
        }));
      }
    };

    wsRef.current.onclose = (event) => {
      console.log(`🔌 WebSocket closed: code=${event.code}, reason=${event.reason}`);
      setConnected(false);
      
      // Ne pas reconnecter pour les fermetures normales
      if (event.code === 1000 || event.code === 1001) {
        console.log("WebSocket closed cleanly");
        return;
      }

      // Reconnecter avec backoff exponentiel
      const delay = Math.min(
        BASE_RECONNECT_DELAY * Math.pow(1.5, reconnectAttemptsRef.current),
        30000
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
        console.log(`📨 WebSocket message: ${msg.type}`);
        
        // Exécuter les handlers enregistrés
        const handlers = handlersRef.current.get(msg.type);
        if (handlers) {
          handlers.forEach(fn => fn(msg.payload));
        }
        
        // Invalider les requêtes selon le type de message
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
  }, [queryClient, toast, lang, getWebSocketUrl]);

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
    connected,
    subscribe, 
    emit 
  };
}