// src/hooks/use-websocket.ts
import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "./use-toast";
import { useTranslation } from "@/lib/i18n";

const MAX_RECONNECT_ATTEMPTS = 5; // Reduced from 10
const BASE_RECONNECT_DELAY = 2000; // Increased from 1000

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
    // Always use secure WebSocket in production
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    // Remove any path from host (like /ws if it's already there)
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
    if (!mountedRef.current) return;
    
    // Éviter les reconnexions trop rapides
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.warn("Max WebSocket reconnection attempts reached");
      return;
    }
  
    try {
      const wsUrl = getWebSocketUrl();
      console.log(`🔌 WebSocket connecting to: ${wsUrl}`);
      
      // Fermer l'ancienne connexion
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
  
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
  
      // Timeout de connexion
      const timeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
        }
      }, 5000);
  
      ws.onopen = () => {
        clearTimeout(timeout);
        console.log("✅ WebSocket connected");
        if (mountedRef.current) {
          setConnected(true);
          reconnectAttemptsRef.current = 0;
          sendAuth();
        }
      };
  
      ws.onclose = (event) => {
        clearTimeout(timeout);
        console.log(`🔌 WebSocket closed: code=${event.code}`);
        
        if (mountedRef.current) {
          setConnected(false);
        }
        
        // Ne pas reconnecter pour les fermetures propres
        if (event.code === 1000 || event.code === 1001) {
          console.log("Clean close, not reconnecting");
          return;
        }
        
        // Reconnecter avec backoff exponentiel
        if (mountedRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(2000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(`Reconnecting in ${delay}ms...`);
          
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        }
      };
  
      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
  
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          // ... reste du code
        } catch (err) {
          console.error("Failed to parse WS message", err);
        }
      };
    } catch (error) {
      console.error("Error creating WebSocket:", error);
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