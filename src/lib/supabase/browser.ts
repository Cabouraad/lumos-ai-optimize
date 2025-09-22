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
      _bootError = 'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY';
      console.error('Supabase environment validation failed: Missing required environment variables');
      return supabase; // Return client anyway, will use defaults from integrations/supabase/client.ts
    }
    return supabase;
  } catch (error) {
    _bootError = (error as any)?.message || String(error);
    console.error('Supabase environment validation failed:', error);
    return supabase; // Don't throw, return client to prevent app freeze
  }
}

export function getSupabaseBootError() { 
  return _bootError; 
}