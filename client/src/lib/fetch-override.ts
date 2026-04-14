import { API_BASE_URL } from './api';

const originalFetch = window.fetch;

window.fetch = function(url: RequestInfo | URL, options?: RequestInit): Promise<Response> {
  if (typeof url === 'string' && url.startsWith('/')) {
    const fullUrl = `${API_BASE_URL}${url}`;
    console.log(`🌐 [OVERRIDE] ${url} -> ${fullUrl}`);
    
    const isFormData = options?.body instanceof FormData;
    
    // Ne pas modifier les headers pour FormData
    const headers: HeadersInit = {
      ...options?.headers,
    };
    
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
      headers['Accept'] = 'application/json';
    }

    const newOptions: RequestInit = {
      ...options,
      credentials: 'include',
      headers: headers,
    };
    
    return originalFetch(fullUrl, newOptions);
  }
  
  return originalFetch(url, options);
};

console.log('✅ Fetch override installed');