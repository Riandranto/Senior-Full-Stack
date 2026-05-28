import { useAuth } from '@/hooks/use-auth';
import { useWebSocketEvents } from '@/hooks/use-websocket-events';
import { memo } from 'react';

export const WebSocketEventManager = memo(function WebSocketEventManager() {
  const { user } = useAuth();
  
  useWebSocketEvents(user?.id, user?.role);
  return null;
});