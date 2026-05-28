// client/src/context/WebSocketContext.tsx
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth'

type WebSocketContextType = {
  connected: boolean;
  subscribe: (eventType: string, handler: (data: any) => void) => () => void;
  sendMessage: (message: any) => boolean;
  disconnect: () => void;
};

const WebSocketContext = createContext<WebSocketContextType | null>(null);

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;
const HEARTBEAT_INTERVAL = 30000;

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout>();
  const heartbeatTimerRef = useRef<NodeJS.Timeout>();
  const intentionalCloseRef = useRef(false);
  const isMountedRef = useRef(true);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const getWebSocketUrl = useCallback(() => {
    // Utiliser la même base que l'API
    let base = API_BASE_URL;
    // Remplacer http:// par ws:// et https:// par wss://
    let wsUrl = base.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://');
    // S'assurer qu'il n'y a pas de slash en trop
    if (!wsUrl.endsWith('/')) wsUrl += '/';
    wsUrl += 'ws';
    console.log('🔌 [WS] Generated URL:', wsUrl);
    return wsUrl;
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = undefined;
    }
  }, []);

  const cancelReconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = undefined;
    }
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
          console.log('🔐 [WS] Auth sent for user', user.id);
        }
      }
    } catch (e) {
      console.error('[WS] Error sending auth:', e);
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    heartbeatTimerRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, HEARTBEAT_INTERVAL);
  }, [stopHeartbeat]);

  const closeConnection = useCallback((code = 1000, reason = "Normal closure") => {
    intentionalCloseRef.current = true;
    stopHeartbeat();
    cancelReconnect();
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      if (wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close(code, reason);
      }
      wsRef.current = null;
    }
    if (isMountedRef.current) {
      setConnected(false);
    }
  }, [stopHeartbeat, cancelReconnect]);

  const connect = useCallback(() => {
    if (!isMountedRef.current) return;
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.warn(`[WS] Max reconnection attempts reached (${MAX_RECONNECT_ATTEMPTS})`);
      return;
    }
    intentionalCloseRef.current = false;
    if (wsRef.current) {
      closeConnection(1000, "Replacing old connection");
    }

    const wsUrl = getWebSocketUrl();
    console.log(`[WS] Connecting to ${wsUrl} (attempt ${reconnectAttemptsRef.current + 1}/${MAX_RECONNECT_ATTEMPTS})`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    const connectionTimeout = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        console.warn('[WS] Connection timeout');
        ws.close(1000, "Connection timeout");
      }
    }, 10000);

    ws.onopen = () => {
      clearTimeout(connectionTimeout);
      if (!isMountedRef.current) return;
      reconnectAttemptsRef.current = 0;
      setConnected(true);
      console.log('[WS] Connected successfully');
      sendAuth();
      startHeartbeat();
    };

    ws.onclose = (event) => {
      clearTimeout(connectionTimeout);
      if (!isMountedRef.current) return;
      setConnected(false);
      stopHeartbeat();
      console.log(`[WS] Closed: code=${event.code}, reason=${event.reason}`);

      if (intentionalCloseRef.current) {
        console.log('[WS] Intentional close, no reconnect');
        return;
      }
      if (event.code === 1000 || event.code === 1001) {
        console.log(`[WS] Clean close (code ${event.code}), not reconnecting`);
        return;
      }
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        const delay = Math.min(
          BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current),
          MAX_RECONNECT_DELAY
        );
        console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${MAX_RECONNECT_ATTEMPTS})`);
        cancelReconnect();
        reconnectTimerRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++;
          connect();
        }, delay);
      } else {
        console.error(`[WS] Max attempts reached, stopping.`);
      }
    };

    ws.onerror = (error) => {
      console.error('[WS] Error:', error);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { type, payload } = msg;
        if (type === 'pong') return;
        const handlers = handlersRef.current.get(type);
        if (handlers) {
          handlers.forEach(handler => {
            try { handler(payload); } catch (err) { console.error(`[WS] Handler error for ${type}:`, err); }
          });
        }
        // Invalidation automatique pour certains types
        if (type === 'RIDE_STATUS_CHANGED' || type === 'OFFER_ACCEPTED') {
          queryClient.invalidateQueries({ queryKey: ['/api/rides/active'] });
          queryClient.invalidateQueries({ queryKey: ['/api/driver/active-ride'] });
        }
        if (type === 'BOOKING_NEW' || type === 'BOOKING_OFFER_ACCEPTED') {
          queryClient.invalidateQueries({ queryKey: ['/api/driver/bookings'] });
        }
      } catch (err) {
        console.error('[WS] Parse error:', err);
      }
    };
  }, [getWebSocketUrl, sendAuth, startHeartbeat, stopHeartbeat, closeConnection, cancelReconnect, queryClient]);

  const disconnect = useCallback(() => {
    closeConnection(1000, "Manual disconnect");
  }, [closeConnection]);

  const subscribe = useCallback((eventType: string, handler: (data: any) => void) => {
    if (!handlersRef.current.has(eventType)) {
      handlersRef.current.set(eventType, new Set());
    }
    handlersRef.current.get(eventType)!.add(handler);
    return () => {
      handlersRef.current.get(eventType)?.delete(handler);
    };
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(message));
        return true;
      } catch (err) {
        console.error('[WS] Send error:', err);
        return false;
      }
    }
    console.warn(`[WS] Cannot send, not connected`);
    return false;
  }, []);

  useEffect(() => {
    if (user?.id) {
      connect();
    } else {
      disconnect();
    }
    return () => {
      cancelReconnect();
      intentionalCloseRef.current = true;
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounting");
        wsRef.current = null;
      }
      stopHeartbeat();
    };
  }, [user, connect, disconnect, cancelReconnect, stopHeartbeat]);

  return (
    <WebSocketContext.Provider value={{ connected, subscribe, sendMessage, disconnect }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
}