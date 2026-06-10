// API Configuration for both web and desktop environments
export const getApiBaseUrl = (): string => {
  // Check if we're running in Electron
  const isElectron = window.electronAPI?.isElectron || false;
  
  if (isElectron) {
    // In Electron desktop app, backend runs on localhost:5000
    return 'http://localhost:5000';
  } else {
    // In web browser, use relative URLs (same origin)
    return '';
  }
};

// Helper function to build full API URLs
export const buildApiUrl = (endpoint: string): string => {
  const baseUrl = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseUrl}${cleanEndpoint}`;
};

// Environment detection
export const isDesktop = (): boolean => {
  return window.electronAPI?.isElectron || false;
};

export const isWeb = (): boolean => {
  return !isDesktop();
};

// Import the apiRequest function from queryClient
import { apiRequest } from './queryClient';

// API client for making HTTP requests
export const api = {
  get: (url: string) => apiRequest('GET', url),
  post: (url: string, data?: any) => apiRequest('POST', url, data),
  put: (url: string, data?: any) => apiRequest('PUT', url, data),
  delete: (url: string) => apiRequest('DELETE', url),
  patch: (url: string, data?: any) => apiRequest('PATCH', url, data),
}; 