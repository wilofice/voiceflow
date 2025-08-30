/**
 * API Client with Supabase Auth Integration
 * Centralized API client that handles authentication with Supabase tokens
 */

import { supabase } from './supabase';

/**
 * Get the current Supabase session token
 */
export async function getSupabaseToken(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch (error) {
    console.error('Failed to get Supabase session:', error);
    return null;
  }
}

/**
 * Make an authenticated API request with Supabase token
 */
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getSupabaseToken();
  
  const headers = {
    ...options.headers,
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;

  const response = await fetch(fullUrl, {
    ...options,
    headers,
  });

  // Handle 401 (Unauthorized) - token might be expired
  if (response.status === 401) {
    console.warn('API request unauthorized - token may be expired');
    
    // Try to refresh the session
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession();
      if (error || !session) {
        throw new Error('Session refresh failed');
      }
      
      // Retry the request with the new token
      const retryHeaders = {
        ...options.headers,
        'Authorization': `Bearer ${session.access_token}`,
      };
      
      const retryResponse = await fetch(fullUrl, {
        ...options,
        headers: retryHeaders,
      });
      
      if (retryResponse.ok) {
        return retryResponse;
      }
    } catch (refreshError) {
      console.error('Token refresh failed:', refreshError);
    }
    
    // If refresh fails, redirect to login
    if (typeof window !== 'undefined') {
      window.location.href = '/auth/login';
    }
    
    throw new Error('Authentication required. Please log in again.');
  }

  return response;
}

/**
 * Make an authenticated API request and parse JSON response
 */
export async function authenticatedFetchJson<T = any>(
  url: string, 
  options: RequestInit = {}
): Promise<T> {
  const response = await authenticatedFetch(url, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
  }
  
  return response.json();
}

/**
 * Upload a file with authentication
 */
export async function uploadFileWithAuth(
  url: string,
  file: File,
  additionalData: Record<string, string> = {}
): Promise<Response> {
  const formData = new FormData();
  formData.append('file', file);
  
  // Add additional form data
  Object.entries(additionalData).forEach(([key, value]) => {
    formData.append(key, value);
  });

  return authenticatedFetch(url, {
    method: 'POST',
    body: formData,
  });
}