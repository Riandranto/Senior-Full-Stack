// client/src/lib/unknown-searches.ts
export interface UnknownSearch {
    query: string;
    timestamp: number;
    type: 'pickup' | 'dropoff';
  }
  
  const STORAGE_KEY = 'farady_unknown_searches';
  
  export const saveUnknownSearch = (query: string, type: 'pickup' | 'dropoff') => {
    try {
      if (!query || query.trim().length < 3) return;
      const existing: UnknownSearch[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const newSearch: UnknownSearch = { query: query.trim(), timestamp: Date.now(), type };
      // Éviter les doublons exacts récents (moins de 5 min)
      const isRecentlySaved = existing.some(s => s.query === query.trim() && s.type === type && (Date.now() - s.timestamp) < 5 * 60 * 1000);
      if (!isRecentlySaved) {
        existing.unshift(newSearch);
        const trimmed = existing.slice(0, 100);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
        console.log('📝 Unknown search saved:', { query, type });
      }
    } catch (e) {
      console.error('Failed to save unknown search:', e);
    }
  };
  
  export const getUnknownSearches = (): UnknownSearch[] => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  };
  
  export const clearUnknownSearches = () => {
    localStorage.removeItem(STORAGE_KEY);
  };
  
  export const deleteUnknownSearch = (index: number) => {
    try {
      const searches = getUnknownSearches();
      searches.splice(index, 1);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
    } catch (e) {
      console.error('Failed to delete unknown search:', e);
    }
  };