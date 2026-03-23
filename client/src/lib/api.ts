// src/lib/api.ts

// Détection de l'environnement
const getBaseUrl = () => {
    // En production (déployé sur Railway)
    if (import.meta.env.PROD) {
      // Utiliser la même URL que le site (relative)
      return '';
    }
    
    // En développement local
    if (import.meta.env.DEV) {
      return 'http://localhost:5000';
    }
    
    return '';
  };
  
  export const API_BASE_URL = getBaseUrl();
  
  // Fonction fetch unifiée
  export async function apiFetch(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
    });
    
    return response;
  }
  
  // Pour les formulaires (multipart/form-data)
  export async function apiFetchFormData(endpoint: string, formData: FormData) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    
    return response;
  }