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
    const newOptions = {
      ...options,
      credentials: 'include',
    };
    
    // Ajouter les headers par défaut si pas déjà présents
    if (!newOptions.headers) {
      newOptions.headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
    }
    
    return originalFetch(fullUrl, newOptions);
  }
  
  // Pour les URLs absolues, les laisser telles quelles
  return originalFetch(url, options);
};

console.log('✅ Fetch override installed'); // Pour debug

// Exporter pour s'assurer que le fichier est importé
export const fetchOverride = true;