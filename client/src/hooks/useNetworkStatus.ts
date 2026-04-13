import { useEffect, useState } from 'react';
import { Network } from '@capacitor/network';

export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [connectionType, setConnectionType] = useState<string>('unknown');

  useEffect(() => {
    let isMounted = true;
    let removeListener: (() => void) | null = null;

    const checkNetwork = async () => {
      try {
        const status = await Network.getStatus();
        if (isMounted) {
          setIsConnected(status.connected);
          setConnectionType(status.connectionType);
        }
      } catch (error) {
        console.error('Network check error:', error);
      }
    };

    checkNetwork();

    // Setup listener avec vérification que remove existe
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
    }).catch(err => {
      console.warn('Failed to add network listener:', err);
    });

    return () => {
      isMounted = false;
      if (removeListener) {
        removeListener();
      }
    };
  }, []);

  return { isConnected, connectionType };
}