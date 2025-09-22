// Unified Supabase browser client for Vite/React app
// Adapts the requested abstraction to this project (no Next.js SSR here)
import { supabase } from '@/integrations/supabase/client';
import { getBrowserEnv } from './env';

let _bootError: string | null = null;

export function getSupabaseBrowserClient() {
  // Environment is now handled with fallbacks, so this should not fail
  try {
    return supabase;
  } catch (error) {
    _bootError = (error as any)?.message || String(error);
    console.error('Supabase client initialization failed:', error);
    return supabase; // Don't throw, return client to prevent app freeze
  }
}

export function getSupabaseBootError() { 
  return _bootError; 
}