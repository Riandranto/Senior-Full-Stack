// api.ts
import { api } from '@shared/routes';

const getBaseUrl = () => {
  console.log('MODE:', import.meta.env.MODE);

  if (import.meta.env.MODE === 'production') {
    return 'https://ride-mada-mg.up.railway.app';
  }

  return 'http://localhost:5000';
};

// api.ts
export const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.MODE === 'production' 
    ? window.location.origin 
    : 'http://localhost:5000');

console.log('🌐 API_BASE_URL:', API_BASE_URL);
console.log('📦 import.meta.env.PROD:', import.meta.env.PROD);
console.log('📦 import.meta.env.MODE:', import.meta.env.MODE);

// Fonction fetch unifiée
export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const url = endpoint.startsWith('http') 
    ? endpoint 
    : `${API_BASE_URL}${endpoint}`;
  
  console.log('🌐 Fetching:', url);
  
  const defaultOptions: RequestInit = {
    credentials: 'include', // TOUJOURS inclure les cookies
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    },
  };
  
  try {
    const response = await fetch(url, {
      ...defaultOptions,
      ...options,
    });
    
    console.log(`📡 Response: ${response.status} ${response.statusText}`);
    
    // Vérifier les cookies dans la réponse
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      console.log('🍪 Set-Cookie received');
    }
    
    return response;
  } catch (err) {
    console.error("❌ FETCH ERROR:", err);
    throw err;
  }
}

// Pour les formulaires
export async function apiFetchFormData(endpoint: string, formData: FormData) {
  const url = endpoint.startsWith('http') 
    ? endpoint 
    : `${API_BASE_URL}${endpoint}`;
  
  console.log('🌐 Uploading to:', url);
  
  const response = await fetch(url, {
    method: 'POST',
    body: formData,
    credentials: 'include', // TOUJOURS inclure les cookies
  });
  
  return response;
}