// client/src/lib/fetch-override.ts
import { API_BASE_URL } from './api';

const originalFetch = window.fetch;

// Fonction pour vérifier si l'URL est relative
function isRelativeUrl(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//');
}

window.fetch = function(url: RequestInfo | URL, options?: RequestInit): Promise<Response> {
  if (typeof url === 'string' && isRelativeUrl(url)) {
    const fullUrl = `${API_BASE_URL}${url}`;
    console.log(`🌐 [OVERRIDE] ${url} -> ${fullUrl}`);
    
    const newOptions: RequestInit = {
      ...options,
      credentials: 'include',
      headers: {
        ...options?.headers,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };
    
    // Ne pas ajouter Content-Type pour FormData
    if (options?.body instanceof FormData) {
      delete newOptions.headers?.['Content-Type'];
    }
    
    return originalFetch(fullUrl, newOptions);
  }
  
  return originalFetch(url, options);
};