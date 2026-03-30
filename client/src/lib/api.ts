// src/lib/api.ts
import { api } from '@shared/routes';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.MODE === 'production' 
    ? window.location.origin 
    : 'http://localhost:5000');

console.log('🌐 API_BASE_URL:', API_BASE_URL);

export class ApiError extends Error {
  status: number;
  data?: any;
  
  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// Fonction fetch unifiée avec gestion d'erreurs améliorée
export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const url = endpoint.startsWith('http') 
    ? endpoint 
    : `${API_BASE_URL}${endpoint}`;
  
  const defaultOptions: RequestInit = {
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      ...options.headers,
    },
  };
  
  // Ne pas ajouter Content-Type pour FormData
  if (!(options.body instanceof FormData)) {
    defaultOptions.headers = {
      ...defaultOptions.headers,
      'Content-Type': 'application/json',
    };
  }
  
  try {
    const response = await fetch(url, {
      ...defaultOptions,
      ...options,
    });
    
    // Gérer les erreurs HTTP
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: response.statusText };
      }
      
      const errorMessage = errorData.message || `Erreur ${response.status}`;
      throw new ApiError(errorMessage, response.status, errorData);
    }
    
    return response;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Erreur réseau
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new ApiError(
        'Impossible de se connecter au serveur. Vérifiez votre connexion.',
        0,
        { networkError: true }
      );
    }
    
    throw new ApiError(
      error instanceof Error ? error.message : 'Erreur inconnue',
      500
    );
  }
}

// Version avec gestion d'erreurs et toast automatique
export async function apiFetchWithToast(
  endpoint: string, 
  options: RequestInit = {},
  toast?: any,
  lang?: string
): Promise<any> {
  try {
    const response = await apiFetch(endpoint, options);
    return await response.json();
  } catch (error) {
    if (error instanceof ApiError && toast) {
      toast({
        variant: "destructive",
        title: lang === 'mg' ? "Tsy nety" : "Erreur",
        description: error.message,
      });
    }
    throw error;
  }
}