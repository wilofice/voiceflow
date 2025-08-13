import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Check if Supabase is configured
const isSupabaseConfigured = supabaseUrl && supabaseAnonKey;

// For client-side usage
export const supabase = isSupabaseConfigured 
  ? createSupabaseClient(supabaseUrl, supabaseAnonKey)
  : null as any;

// For server-side usage with Next.js
export function createServerClient() {
  if (!isSupabaseConfigured) {
    console.warn('Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.');
    return null as any;
  }
  
  return createBrowserClient(
    supabaseUrl,
    supabaseAnonKey
  );
}

// Export default client creation function for compatibility
export function createClient() {
  if (!isSupabaseConfigured) {
    console.warn('Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.');
    return null as any;
  }
  
  return createSupabaseClient(supabaseUrl, supabaseAnonKey);
}

export { isSupabaseConfigured };