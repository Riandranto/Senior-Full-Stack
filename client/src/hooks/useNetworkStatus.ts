import { useEffect, useState } from 'react';
import { Network } from '@capacitor/network';

export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [connectionType, setConnectionType] = useState<string>('unknown');

  useEffect(() => {
    const checkNetwork = async () => {
      const status = await Network.getStatus();
      setIsConnected(status.connected);
      setConnectionType(status.connectionType);
    };

    checkNetwork();

    const handler = Network.addListener('networkStatusChange', (status) => {
      setIsConnected(status.connected);
      setConnectionType(status.connectionType);
    });

    return () => {
      handler.remove();
    };
  }, []);

  return { isConnected, connectionType };
}