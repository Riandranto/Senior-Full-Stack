// src/hooks/use-websocket.ts - Version corrigée
import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

const MAX_RECONNECT_ATTEMPTS = 3; // Réduit à 3
const BASE_RECONNECT_DELAY = 5000; // 5 secondes

export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout>();
  const queryClient = useQueryClient();
  const mountedRef = useRef(true);
  const isConnectingRef = useRef(false);

  const getWebSocketUrl = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const cleanHost = host.split('/')[0];
    return `${protocol}//${cleanHost}/ws`;
  }, []);

  const sendAuth = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        if (user.id) {
          wsRef.current.send(JSON.stringify({
            type: 'auth',
            payload: { userId: user.id }
          }));
          console.log(`🔐 Authenticated as user: ${user.id}`);
        }
      }
    } catch (e) {
      console.error('Error sending auth:', e);
    }
  }, []);

  const connect = useCallback(() => {
    // Éviter les connexions simultanées
    if (isConnectingRef.current) {
      console.log("Already connecting, skipping...");
      return;
    }
    
    if (!mountedRef.current) return;
    
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.warn("Max WebSocket reconnection attempts reached");
      return;
    }
  
    isConnectingRef.current = true;
    
    try {
      const wsUrl = getWebSocketUrl();
      console.log(`🔌 WebSocket connecting to: ${wsUrl}`);
      
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
  
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
  
      const timeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.log("WebSocket connection timeout");
          ws.close();
          isConnectingRef.current = false;
        }
      }, 10000);
  
      ws.onopen = () => {
        clearTimeout(timeout);
        console.log("✅ WebSocket connected");
        if (mountedRef.current) {
          setConnected(true);
          reconnectAttemptsRef.current = 0;
          sendAuth();
        }
        isConnectingRef.current = false;
      };
  
      ws.onclose = (event) => {
        clearTimeout(timeout);
        console.log(`🔌 WebSocket closed: code=${event.code}, reason=${event.reason}`);
        
        if (mountedRef.current) {
          setConnected(false);
        }
        isConnectingRef.current = false;
        
        if (event.code === 1000 || event.code === 1001) {
          console.log("Clean close, not reconnecting");
          return;
        }
        
        if (mountedRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(`Reconnecting in ${delay}ms... (attempt ${reconnectAttemptsRef.current + 1}/${MAX_RECONNECT_ATTEMPTS})`);
          
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        }
      };
  
      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        // Ne pas reconnecter immédiatement, laisser onclose gérer
      };
  
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          const { type, payload } = msg;
          
          if (handlersRef.current.has(type)) {
            handlersRef.current.get(type)?.forEach(handler => {
              try {
                handler(payload);
              } catch (err) {
                console.error(`Error in handler for ${type}:`, err);
              }
            });
          }
          
          // Invalider les requêtes pertinentes
          if (type === 'RIDE_STATUS_CHANGED' || type === 'OFFER_ACCEPTED') {
            queryClient.invalidateQueries({ queryKey: ['/api/rides/active'] });
            queryClient.invalidateQueries({ queryKey: ['/api/driver/active-ride'] });
          }
        } catch (err) {
          console.error("Failed to parse WS message", err);
        }
      };
    } catch (error) {
      console.error("Error creating WebSocket:", error);
      isConnectingRef.current = false;
    }
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
      try {
        wsRef.current.send(JSON.stringify(message));
        return true;
      } catch (err) {
        console.error("Error sending WebSocket message:", err);
        return false;
      }
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