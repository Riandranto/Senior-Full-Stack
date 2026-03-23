// api.ts
const getBaseUrl = () => {
  // Check if we're in production (Railway)
  // In Railway, process.env.NODE_ENV is 'production'
  if (import.meta.env.PROD) {
    console.log('🚀 Running in PRODUCTION mode');
    return ''; // Empty string means use same origin
  }
  
  // Check if we have a VITE_API_URL environment variable
  if (import.meta.env.VITE_API_URL) {
    console.log('📡 Using VITE_API_URL:', import.meta.env.VITE_API_URL);
    return import.meta.env.VITE_API_URL;
  }
  
  // In development, use localhost
  console.log('💻 Running in DEVELOPMENT mode');
  return 'http://localhost:5000';
};

export const API_BASE_URL = getBaseUrl();

console.log('🌐 API_BASE_URL:', API_BASE_URL);
console.log('📦 import.meta.env.PROD:', import.meta.env.PROD);
console.log('📦 import.meta.env.MODE:', import.meta.env.MODE);

// Fonction fetch unifiée
export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  // Build the URL correctly
  const url = API_BASE_URL 
    ? `${API_BASE_URL}${endpoint}`
    : endpoint;
  
  console.log('🌐 Fetching:', url);
  
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
  const url = API_BASE_URL 
    ? `${API_BASE_URL}${endpoint}`
    : endpoint;
  
  const response = await fetch(url, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });
  
  return response;
}