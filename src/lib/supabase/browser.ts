// Unified Supabase browser client for Vite/React app
// Adapts the requested abstraction to this project (no Next.js SSR here)
import { supabase } from '@/integrations/supabase/client';
import { getBrowserEnv } from './env';

export function getSupabaseBrowserClient() {
  // Validate environment at runtime
  try {
    getBrowserEnv();
  } catch (error) {
    console.error('Supabase environment validation failed:', error);
    throw error;
  }
  
  return supabase;
}
