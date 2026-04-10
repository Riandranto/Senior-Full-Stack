// client/src/lib/offline-sync.ts
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { capacitorStorage, OfflineQueueItem } from './capacitor-storage';

class OfflineSyncService {
  private isSyncing: boolean = false;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor() {
    if (Capacitor.isNativePlatform()) {
      this.initNetworkListener();
    }
  }

  private initNetworkListener(): void {
    Network.addListener('networkStatusChange', (status) => {
      if (status.connected) {
        console.log('🌐 Network connected, syncing offline data...');
        this.syncOfflineQueue();
      } else {
        console.log('📴 Network disconnected, entering offline mode');
        capacitorStorage.setOfflineMode(true);
      }
    });
  }

  async startAutoSync(intervalMs: number = 30000): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    this.syncInterval = setInterval(() => {
      this.syncOfflineQueue();
    }, intervalMs);
  }

  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  async syncOfflineQueue(): Promise<{ success: number; failed: number }> {
    if (this.isSyncing) {
      return { success: 0, failed: 0 };
    }

    // Vérifier la connexion
    let isConnected = true;
    if (Capacitor.isNativePlatform()) {
      const status = await Network.getStatus();
      isConnected = status.connected;
    } else {
      isConnected = navigator.onLine;
    }

    if (!isConnected) {
      await capacitorStorage.setOfflineMode(true);
      return { success: 0, failed: 0 };
    }

    this.isSyncing = true;
    let success = 0;
    let failed = 0;

    try {
      const queue = await capacitorStorage.getOfflineQueue();
      
      if (queue.length === 0) {
        await capacitorStorage.setOfflineMode(false);
        return { success: 0, failed: 0 };
      }

      console.log(`🔄 Syncing ${queue.length} offline items...`);

      for (const item of queue) {
        try {
          const response = await fetch(item.url, {
            method: item.method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.body),
            credentials: 'include',
          });

          if (response.ok) {
            await capacitorStorage.removeFromOfflineQueue(item.id);
            success++;
            console.log(`✅ Synced: ${item.method} ${item.url}`);
          } else if (item.retryCount < 3) {
            item.retryCount++;
            await capacitorStorage.setOfflineQueue(queue);
            failed++;
          } else {
            await capacitorStorage.removeFromOfflineQueue(item.id);
            failed++;
          }
        } catch (error) {
          console.error(`❌ Failed to sync ${item.url}:`, error);
          if (item.retryCount < 3) {
            item.retryCount++;
            await capacitorStorage.setOfflineQueue(queue);
            failed++;
          } else {
            await capacitorStorage.removeFromOfflineQueue(item.id);
            failed++;
          }
        }
      }

      if (success > 0) {
        console.log(`🎉 Sync complete: ${success} succeeded, ${failed} failed`);
        await capacitorStorage.setLastSync(new Date().toISOString());
      }

      const remainingQueue = await capacitorStorage.getOfflineQueue();
      await capacitorStorage.setOfflineMode(remainingQueue.length > 0);
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      this.isSyncing = false;
    }

    return { success, failed };
  }

  async saveDataForOffline(): Promise<void> {
    try {
      const userResponse = await fetch('/api/auth/me', { credentials: 'include' });
      if (userResponse.ok) {
        const user = await userResponse.json();
        await capacitorStorage.setUser(user);
      }

      const ridesResponse = await fetch('/api/rides/active', { credentials: 'include' });
      if (ridesResponse.ok) {
        const rides = await ridesResponse.json();
        await capacitorStorage.setRides(rides ? [rides] : []);
      }

      const bookingsResponse = await fetch('/api/bookings', { credentials: 'include' });
      if (bookingsResponse.ok) {
        const bookings = await bookingsResponse.json();
        await capacitorStorage.setBookings(bookings);
      }

      await capacitorStorage.setLastSync(new Date().toISOString());
      console.log('💾 Data saved for offline use');
    } catch (error) {
      console.error('Error saving offline data:', error);
    }
  }

  addNetworkListener(callback: (isConnected: boolean) => void): () => void {
    if (Capacitor.isNativePlatform()) {
      const listener = Network.addListener('networkStatusChange', (status) => {
        callback(status.connected);
      });
      return () => listener.remove();
    } else {
      const handler = () => callback(navigator.onLine);
      window.addEventListener('online', handler);
      window.addEventListener('offline', handler);
      return () => {
        window.removeEventListener('online', handler);
        window.removeEventListener('offline', handler);
      };
    }
  }
}

export const offlineSync = new OfflineSyncService();