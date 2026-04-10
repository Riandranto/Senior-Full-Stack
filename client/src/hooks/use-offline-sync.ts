
import { useEffect, useState, useCallback } from 'react';
import { offlineSync } from '@/lib/offline-sync';
import { capacitorStorage } from '@/lib/capacitor-storage';
import { useToast } from './use-toast';
import { useTranslation } from '@/lib/i18n';

export function useOfflineSync() {
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const { toast } = useToast();
  const { lang } = useTranslation();

  const loadStatus = useCallback(async () => {
    const offline = await capacitorStorage.isOfflineMode();
    const syncTime = await capacitorStorage.getLastSync();
    const queue = await capacitorStorage.getOfflineQueue();
    
    setIsOfflineMode(offline);
    setLastSync(syncTime);
    setPendingSyncCount(queue.length);
  }, []);

  const syncNow = useCallback(async () => {
    setIsSyncing(true);
    try {
      const result = await offlineSync.syncOfflineQueue();
      
      if (result.success > 0) {
        toast({
          title: lang === 'mg' ? 'Synchronisation natao' : 'Synchronisation effectuée',
          description: lang === 'mg'
            ? `${result.success} natao, ${result.failed} tsy nety`
            : `${result.success} synchronisé(s), ${result.failed} échec(s)`,
        });
      }
      
      await loadStatus();
    } catch (error) {
      console.error('Sync error:', error);
      toast({
        variant: 'destructive',
        title: lang === 'mg' ? 'Tsy nety ny synchronisation' : 'Échec de synchronisation',
      });
    } finally {
      setIsSyncing(false);
    }
  }, [toast, lang, loadStatus]);

  const saveDataForOffline = useCallback(async () => {
    try {
      await offlineSync.saveDataForOffline();
      await loadStatus();
      toast({
        title: lang === 'mg' ? 'Data voatahiry' : 'Données sauvegardées',
        description: lang === 'mg'
          ? 'Azonao ampiasaina tsy misy Internet'
          : 'Utilisable sans connexion Internet',
      });
    } catch (error) {
      console.error('Error saving offline data:', error);
    }
  }, [toast, lang, loadStatus]);

  useEffect(() => {
    loadStatus();
    
    const removeListener = offlineSync.addNetworkListener(async (connected) => {
      if (connected) {
        console.log('🌐 Network connected, syncing...');
        await offlineSync.syncOfflineQueue();
        await loadStatus();
      } else {
        console.log('📴 Network disconnected');
        setIsOfflineMode(true);
      }
    });

    offlineSync.startAutoSync();
    
    return () => {
      offlineSync.stopAutoSync();
      removeListener();
    };
  }, [loadStatus]);

  return {
    isOfflineMode,
    isSyncing,
    lastSync,
    pendingSyncCount,
    syncNow,
    saveDataForOffline,
  };
}