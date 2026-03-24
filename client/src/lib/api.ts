// api.ts
import { api } from '@shared/routes';

const getBaseUrl = () => {
  console.log('MODE:', import.meta.env.MODE);

  if (import.meta.env.MODE === 'production') {
    return 'https://ride-mada-mg.up.railway.app';
  }

  return 'http://localhost:5000';
};

export const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.MODE === 'production' 
    ? window.location.origin 
    : 'http://localhost:5000');

console.log('🌐 API_BASE_URL:', API_BASE_URL);
console.log('📦 import.meta.env.PROD:', import.meta.env.PROD);
console.log('📦 import.meta.env.MODE:', import.meta.env.MODE);

// Fonction fetch unifiée avec gestion d'erreur améliorée
export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  // Construire l'URL correctement
  const url = endpoint.startsWith('http') 
    ? endpoint 
    : `${API_BASE_URL}${endpoint}`;
  
  console.log('🌐 Fetching:', url);
  
  // Configuration par défaut
  const defaultOptions: RequestInit = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    },
  };
  
  let response;

  try {
    response = await fetch(url, {
      ...defaultOptions,
      ...options,
    });
  } catch (err) {
    console.error("❌ FETCH ERROR:", err);
    throw err;
  }
  
  // Log pour debug
  console.log(`📡 Response: ${response.status} ${response.statusText}`);
  
  return response;
}

// Pour les formulaires (multipart/form-data)
export async function apiFetchFormData(endpoint: string, formData: FormData) {
  const url = endpoint.startsWith('http') 
    ? endpoint 
    : `${API_BASE_URL}${endpoint}`;
  
  console.log('🌐 Uploading to:', url);
  
  const response = await fetch(url, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });
  
  return response;
}