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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { lang } = useTranslation();
  const mountedRef = useRef(true);

  const getWebSocketUrl = useCallback(() => {
    const isProduction = window.location.hostname !== 'localhost' && 
                         window.location.hostname !== '127.0.0.1';
    
    if (isProduction) {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      return `${protocol}//${host}/ws`;
    }
    return 'ws://localhost:5000/ws';
  }, []);

  const sendAuth = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    const storedUser = localStorage.getItem('user');
    let userId = null;
    try {
      if (storedUser) {
        const user = JSON.parse(storedUser);
        userId = user.id;
      }
    } catch (e) {}
    
    if (userId) {
      wsRef.current.send(JSON.stringify({
        type: 'auth',
        payload: { userId }
      }));
      console.log(`🔐 Authenticated as user: ${userId}`);
    }
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.error("Max WebSocket reconnection attempts reached");
      return;
    }

    const wsUrl = getWebSocketUrl();
    console.log(`🔌 WebSocket connecting to: ${wsUrl}`);
    
    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("✅ WebSocket connected");
      if (mountedRef.current) {
        setConnected(true);
        reconnectAttemptsRef.current = 0;
        // Envoyer l'auth après la connexion
        setTimeout(() => sendAuth(), 100);
      }
    };

    ws.onclose = (event) => {
      console.log(`🔌 WebSocket closed: code=${event.code}, reason=${event.reason}`);
      if (mountedRef.current) {
        setConnected(false);
      }
      
      if (event.code === 1000 || event.code === 1001) {
        console.log("WebSocket closed cleanly");
        return;
      }

      if (!mountedRef.current) return;

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

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        console.log(`📨 WebSocket message: ${msg.type}`, msg.payload);
        
        const handlers = handlersRef.current.get(msg.type);
        if (handlers) {
          handlers.forEach(fn => fn(msg.payload));
        }
        
        switch (msg.type) {
          case 'RIDE_STATUS_CHANGED':
            queryClient.invalidateQueries({ queryKey: ['/api/driver/active-ride'] });
            queryClient.invalidateQueries({ queryKey: ['/api/rides/active'] });
            queryClient.invalidateQueries({ queryKey: ['/api/driver/requests'] });
            break;
            
          case 'CHAT_MESSAGE':
            queryClient.invalidateQueries({ queryKey: ['/api/chat/history', msg.payload.rideId] });
            break;
            
          case 'OFFER_ACCEPTED':
            queryClient.invalidateQueries({ queryKey: ['/api/driver/active-ride'] });
            queryClient.invalidateQueries({ queryKey: ['/api/rides/active'] });
            queryClient.invalidateQueries({ queryKey: ['/api/driver/requests'] });
            break;
        }
      } catch (err) {
        console.error("Failed to parse WS message", err);
      }
    };
  }, [queryClient, getWebSocketUrl, sendAuth]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
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

    return () => {
      handlersRef.current.get(event)?.delete(handler);
    };
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
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