// client/src/lib/capacitor-storage.ts
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

export interface OfflineData {
  rides: any[];
  bookings: any[];
  notifications: any[];
  user: any | null;
  lastSync: string | null;
}

const STORAGE_KEYS = {
  USER: 'farady_user',
  RIDES: 'farady_rides',
  BOOKINGS: 'farady_bookings',
  NOTIFICATIONS: 'farady_notifications',
  LAST_SYNC: 'farady_last_sync',
  OFFLINE_QUEUE: 'farady_offline_queue',
  OFFLINE_MODE: 'farady_offline_mode',
};

export interface OfflineQueueItem {
  id: string;
  url: string;
  method: string;
  body: any;
  timestamp: number;
  retryCount: number;
}

class CapacitorStorageService {
  private isCapacitor: boolean;

  constructor() {
    this.isCapacitor = Capacitor.isNativePlatform();
  }

  async setUser(user: any): Promise<void> {
    if (this.isCapacitor) {
      await Preferences.set({
        key: STORAGE_KEYS.USER,
        value: JSON.stringify(user),
      });
    } else {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    }
  }

  async getUser(): Promise<any | null> {
    try {
      if (this.isCapacitor) {
        const { value } = await Preferences.get({ key: STORAGE_KEYS.USER });
        return value ? JSON.parse(value) : null;
      }
      const value = localStorage.getItem(STORAGE_KEYS.USER);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  }

  async setRides(rides: any[]): Promise<void> {
    const data = {
      items: rides,
      lastUpdate: new Date().toISOString(),
    };
    if (this.isCapacitor) {
      await Preferences.set({
        key: STORAGE_KEYS.RIDES,
        value: JSON.stringify(data),
      });
    } else {
      localStorage.setItem(STORAGE_KEYS.RIDES, JSON.stringify(data));
    }
  }

  async getRides(): Promise<any[]> {
    try {
      let value: string | null = null;
      if (this.isCapacitor) {
        const result = await Preferences.get({ key: STORAGE_KEYS.RIDES });
        value = result.value;
      } else {
        value = localStorage.getItem(STORAGE_KEYS.RIDES);
      }
      if (value) {
        const data = JSON.parse(value);
        return data.items || [];
      }
      return [];
    } catch {
      return [];
    }
  }

  async setBookings(bookings: any[]): Promise<void> {
    const data = {
      items: bookings,
      lastUpdate: new Date().toISOString(),
    };
    if (this.isCapacitor) {
      await Preferences.set({
        key: STORAGE_KEYS.BOOKINGS,
        value: JSON.stringify(data),
      });
    } else {
      localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(data));
    }
  }

  async getBookings(): Promise<any[]> {
    try {
      let value: string | null = null;
      if (this.isCapacitor) {
        const result = await Preferences.get({ key: STORAGE_KEYS.BOOKINGS });
        value = result.value;
      } else {
        value = localStorage.getItem(STORAGE_KEYS.BOOKINGS);
      }
      if (value) {
        const data = JSON.parse(value);
        return data.items || [];
      }
      return [];
    } catch {
      return [];
    }
  }

  async setNotifications(notifications: any[]): Promise<void> {
    const data = {
      items: notifications,
      lastUpdate: new Date().toISOString(),
    };
    if (this.isCapacitor) {
      await Preferences.set({
        key: STORAGE_KEYS.NOTIFICATIONS,
        value: JSON.stringify(data),
      });
    } else {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(data));
    }
  }

  async getNotifications(): Promise<any[]> {
    try {
      let value: string | null = null;
      if (this.isCapacitor) {
        const result = await Preferences.get({ key: STORAGE_KEYS.NOTIFICATIONS });
        value = result.value;
      } else {
        value = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      }
      if (value) {
        const data = JSON.parse(value);
        return data.items || [];
      }
      return [];
    } catch {
      return [];
    }
  }

  async addToOfflineQueue(item: Omit<OfflineQueueItem, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    const queue = await this.getOfflineQueue();
    const newItem: OfflineQueueItem = {
      ...item,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0,
    };
    queue.push(newItem);
    await this.setOfflineQueue(queue);
  }

  async getOfflineQueue(): Promise<OfflineQueueItem[]> {
    try {
      let value: string | null = null;
      if (this.isCapacitor) {
        const result = await Preferences.get({ key: STORAGE_KEYS.OFFLINE_QUEUE });
        value = result.value;
      } else {
        value = localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
      }
      return value ? JSON.parse(value) : [];
    } catch {
      return [];
    }
  }

  async setOfflineQueue(queue: OfflineQueueItem[]): Promise<void> {
    if (this.isCapacitor) {
      await Preferences.set({
        key: STORAGE_KEYS.OFFLINE_QUEUE,
        value: JSON.stringify(queue),
      });
    } else {
      localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
    }
  }

  async removeFromOfflineQueue(id: string): Promise<void> {
    const queue = await this.getOfflineQueue();
    const newQueue = queue.filter(item => item.id !== id);
    await this.setOfflineQueue(newQueue);
  }

  async clearOfflineQueue(): Promise<void> {
    await this.setOfflineQueue([]);
  }

  async setOfflineMode(enabled: boolean): Promise<void> {
    if (this.isCapacitor) {
      await Preferences.set({
        key: STORAGE_KEYS.OFFLINE_MODE,
        value: JSON.stringify(enabled),
      });
    } else {
      sessionStorage.setItem('offline_mode', enabled ? 'true' : 'false');
    }
  }

  async isOfflineMode(): Promise<boolean> {
    if (this.isCapacitor) {
      const { value } = await Preferences.get({ key: STORAGE_KEYS.OFFLINE_MODE });
      return value ? JSON.parse(value) : false;
    }
    return sessionStorage.getItem('offline_mode') === 'true';
  }

  async setLastSync(time: string): Promise<void> {
    if (this.isCapacitor) {
      await Preferences.set({
        key: STORAGE_KEYS.LAST_SYNC,
        value: time,
      });
    } else {
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC, time);
    }
  }

  async getLastSync(): Promise<string | null> {
    if (this.isCapacitor) {
      const { value } = await Preferences.get({ key: STORAGE_KEYS.LAST_SYNC });
      return value || null;
    }
    return localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
  }

  async clearAll(): Promise<void> {
    const keys = Object.values(STORAGE_KEYS);
    if (this.isCapacitor) {
      for (const key of keys) {
        await Preferences.remove({ key });
      }
    } else {
      for (const key of keys) {
        localStorage.removeItem(key);
      }
    }
  }
}

export const capacitorStorage = new CapacitorStorageService();