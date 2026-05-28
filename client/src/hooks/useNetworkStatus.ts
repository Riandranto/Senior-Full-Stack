// src/hooks/useNetworkStatus.ts
import { useEffect, useState } from 'react';
import { Network } from '@capacitor/network';

export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [connectionType, setConnectionType] = useState<string>('unknown');

  useEffect(() => {
    let isMounted = true;
    let removeListener: (() => void) | null = null;

    // Déterminer si on est dans Capacitor (app mobile) ou dans un navigateur web
    const isCapacitor = !!(window as any).Capacitor?.isNativePlatform();

    const updateStatus = (connected: boolean, type?: string) => {
      if (isMounted) {
        setIsConnected(connected);
        if (type) setConnectionType(type);
      }
    };

    if (isCapacitor) {
      // Utiliser Capacitor
      Network.getStatus()
        .then(status => {
          if (isMounted) {
            setIsConnected(status.connected);
            setConnectionType(status.connectionType);
          }
        })
        .catch(console.error);

      Network.addListener('networkStatusChange', (status) => {
        if (isMounted) {
          setIsConnected(status.connected);
          setConnectionType(status.connectionType);
        }
      }).then(listener => {
        removeListener = () => {
          try {
            listener.remove();
          } catch (e) {
            console.warn('Failed to remove network listener:', e);
          }
        };
      }).catch(console.warn);
    } else {
      // Environnement web : utiliser navigator.onLine + événements
      const handleOnline = () => updateStatus(true, 'wifi');
      const handleOffline = () => updateStatus(false, 'none');
      
      updateStatus(navigator.onLine);
      
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      
      removeListener = () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }

    return () => {
      isMounted = false;
      if (removeListener) removeListener();
    };
  }, []);

  return { isConnected, connectionType };
}