// Unified Supabase browser client for Vite/React app
// Adapts the requested abstraction to this project (no Next.js SSR here)
import { supabase } from '@/integrations/supabase/client';
import { getBrowserEnv } from './env';

let _bootError: string | null = null;

export function getSupabaseBrowserClient() {
  // Validate environment at runtime
  try {
    const { url, anon } = getBrowserEnv();
    if (!url || !anon) {
      throw new Error('Missing VITE_SUPABASE_API / VITE_SUPABASE_ANON_KEY');
    }
    return supabase;
  } catch (error) {
    _bootError = (error as any)?.message || String(error);
    console.error('Supabase environment validation failed:', error);
    throw error;
  }
}

export function getSupabaseBootError() { 
  return _bootError; 
}
