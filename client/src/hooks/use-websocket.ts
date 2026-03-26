// src/hooks/use-websocket.ts
import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "./use-toast";
import { useTranslation } from "@/lib/i18n";

const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000;

export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout>();
  const queryClient = useQueryClient(); // <-- C'est important de déclarer ici
  const { toast } = useToast();
  const { lang } = useTranslation();

  const getWebSocketUrl = useCallback(() => {
    if (import.meta.env.PROD) {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      return `${protocol}//${host}/ws`;
    }
    return 'ws://localhost:5000/ws';
  }, []);

  const connect = useCallback(() => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.error("Max WebSocket reconnection attempts reached");
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
      
      // Récupérer l'utilisateur depuis localStorage ou session
      const storedUser = localStorage.getItem('user');
      let userId = null;
      try {
        if (storedUser) {
          const user = JSON.parse(storedUser);
          userId = user.id;
        }
      } catch (e) {}
      
      if (userId) {
        wsRef.current?.send(JSON.stringify({
          type: 'auth',
          payload: { userId }
        }));
        console.log(`🔐 Authenticated as user: ${userId}`);
      }
    };

    wsRef.current.onclose = (event) => {
      console.log(`🔌 WebSocket closed: code=${event.code}, reason=${event.reason}`);
      setConnected(false);
      
      if (event.code === 1000 || event.code === 1001) {
        console.log("WebSocket closed cleanly");
        return;
      }

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
        const msg = JSON.parse(e.data);
        console.log(`📨 WebSocket message: ${msg.type}`, msg.payload);
        
        // Exécuter les handlers enregistrés
        const handlers = handlersRef.current.get(msg.type);
        if (handlers) {
          handlers.forEach(fn => fn(msg.payload));
        }
        
        // Invalider les requêtes en fonction du type de message
        switch (msg.type) {
          case 'RIDE_STATUS_CHANGED':
            console.log('🔄 RIDE_STATUS_CHANGED:', msg.payload);
            queryClient.invalidateQueries({ queryKey: ['/api/driver/active-ride'] });
            queryClient.invalidateQueries({ queryKey: ['/api/rides/active'] });
            queryClient.invalidateQueries({ queryKey: ['/api/driver/requests'] });
            queryClient.invalidateQueries({ queryKey: ['/api/rides', msg.payload.id] });
            queryClient.invalidateQueries({ queryKey: ['/api/rides', msg.payload.id, 'offers'] });
            break;
            
          case 'CHAT_MESSAGE':
            console.log('💬 CHAT_MESSAGE:', msg.payload);
            queryClient.invalidateQueries({ queryKey: ['/api/chat/history', msg.payload.rideId] });
            break;
            
          case 'OFFER_ACCEPTED':
            console.log('✅ OFFER_ACCEPTED:', msg.payload);
            queryClient.invalidateQueries({ queryKey: ['/api/driver/active-ride'] });
            queryClient.invalidateQueries({ queryKey: ['/api/rides/active'] });
            queryClient.invalidateQueries({ queryKey: ['/api/driver/requests'] });
            queryClient.invalidateQueries({ queryKey: ['/api/rides', msg.payload.rideId] });
            
            setTimeout(() => {
              queryClient.refetchQueries({ queryKey: ['/api/rides/active'] });
              queryClient.refetchQueries({ queryKey: ['/api/driver/active-ride'] });
            }, 100);
            break;
            
          case 'OFFER_NEW':
            console.log('🆕 OFFER_NEW:', msg.payload);
            queryClient.invalidateQueries({ queryKey: ['/api/rides', msg.payload.rideId, 'offers'] });
            break;
            
          case 'DRIVER_LOCATION':
            queryClient.setQueryData(
              ['/api/driver', msg.payload.driverId, 'location'],
              msg.payload
            );
            break;
        }
      } catch (err) {
        console.error("Failed to parse WS message", err);
      }
    };
  }, [queryClient, getWebSocketUrl]);

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

  const subscribe = useCallback((event: string, handler: (data: any) => void) => {
    if (!handlersRef.current.has(event)) {
      handlersRef.current.set(event, new Set());
    }
    handlersRef.current.get(event)!.add(handler);
    console.log(`📡 Subscribed to event: ${event}`);

    return () => {
      handlersRef.current.get(event)?.delete(handler);
      console.log(`📡 Unsubscribed from event: ${event}`);
    };
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      console.log(`📤 Sent message: ${message.type}`, message.payload);
      return true;
    } else {
      console.warn("WebSocket not connected, message not sent:", message.type);
      return false;
    }
  }, []);

  return { 
    connected,
    subscribe, 
    sendMessage
  };
}