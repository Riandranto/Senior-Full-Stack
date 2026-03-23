// src/lib/fetch-override.ts
import { API_BASE_URL } from './api';

// Sauvegarder le fetch original
const originalFetch = window.fetch;

// Override global de fetch pour ajouter l'URL de base automatiquement
window.fetch = function(url: RequestInfo | URL, options?: RequestInit): Promise<Response> {
  // Si c'est une chaîne et que ça commence par / (chemin relatif)
  if (typeof url === 'string' && url.startsWith('/')) {
    const fullUrl = `${API_BASE_URL}${url}`;
    console.log(`🌐 [OVERRIDE] ${url} -> ${fullUrl}`);
    
    // Ajouter les credentials par défaut
    const newOptions: RequestInit = {
      ...options,
      credentials: 'include',
    };
    
    // Ajouter les headers par défaut si pas déjà présents
    if (!newOptions.headers) {
      newOptions.headers = {};
    }
    
    // Ne pas écraser les headers existants
    const headers = newOptions.headers as Record<string, string>;
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    if (!headers['Accept']) {
      headers['Accept'] = 'application/json';
    }
    
    return originalFetch(fullUrl, newOptions);
  }
  
  // Pour les URLs absolues, les laisser telles quelles
  return originalFetch(url, options);
};

console.log('✅ Fetch override installed');

export const fetchOverride = true;