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

const MAX_RECONNECT_ATTEMPTS = 3;
const BASE_RECONNECT_DELAY = 2000;
const MAX_RECONNECT_DELAY = 15000;
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
  const isConnectingRef = useRef(false);

  const getWebSocketUrl = useCallback(() => {
    let base = API_BASE_URL;
    let wsUrl = base.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://');
    if (!wsUrl.endsWith('/')) wsUrl += '/';
    wsUrl += 'ws';
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
      if (user?.id) {
        wsRef.current.send(JSON.stringify({
          type: 'auth',
          payload: { userId: user.id }
        }));
      }
    } catch (e) {
      console.error('[WS] Error sending auth:', e);
    }
  }, [user?.id]);

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
    isConnectingRef.current = false;
  }, [stopHeartbeat, cancelReconnect]);

  const connect = useCallback(() => {
    if (!isMountedRef.current) return;
    if (isConnectingRef.current) return;
    if (!user?.id) return;
    
    isConnectingRef.current = true;
    intentionalCloseRef.current = false;
    
    if (wsRef.current) {
      closeConnection(1000, "Replacing old connection");
    }

    const wsUrl = getWebSocketUrl();
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    const connectionTimeout = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        ws.close(1000, "Connection timeout");
        isConnectingRef.current = false;
      }
    }, 10000);

    ws.onopen = () => {
      clearTimeout(connectionTimeout);
      if (!isMountedRef.current) return;
      reconnectAttemptsRef.current = 0;
      setConnected(true);
      isConnectingRef.current = false;
      sendAuth();
      startHeartbeat();
    };

    ws.onclose = (event) => {
      clearTimeout(connectionTimeout);
      if (!isMountedRef.current) return;
      setConnected(false);
      stopHeartbeat();
      isConnectingRef.current = false;

      if (intentionalCloseRef.current) return;
      if (event.code === 1000 || event.code === 1001) return;
      
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS && user?.id) {
        const delay = Math.min(
          BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current),
          MAX_RECONNECT_DELAY
        );
        cancelReconnect();
        reconnectTimerRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++;
          connect();
        }, delay);
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
      } catch (err) {
        console.error('[WS] Parse error:', err);
      }
    };
  }, [getWebSocketUrl, sendAuth, startHeartbeat, stopHeartbeat, closeConnection, cancelReconnect, user?.id]);

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
        return false;
      }
    }
    return false;
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    if (user?.id) {
      connect();
    }
    return () => {
      isMountedRef.current = false;
      cancelReconnect();
      intentionalCloseRef.current = true;
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounting");
        wsRef.current = null;
      }
      stopHeartbeat();
    };
  }, [user?.id]);

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