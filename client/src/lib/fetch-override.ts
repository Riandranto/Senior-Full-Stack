import { API_BASE_URL } from './api';

const originalFetch = window.fetch;

window.fetch = function(url: RequestInfo | URL, options?: RequestInit): Promise<Response> {
  if (typeof url === 'string' && url.startsWith('/')) {
    const fullUrl = `${API_BASE_URL}${url}`;
    console.log(`🌐 [OVERRIDE] ${url} -> ${fullUrl}`);
    
    const newOptions: RequestInit = {
      ...options,
      credentials: 'include', // FORCER les credentials
      headers: {
        ...options?.headers,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };
    
    return originalFetch(fullUrl, newOptions);
  }
  
  return originalFetch(url, options);
};

console.log('✅ Fetch override installed');