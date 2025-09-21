// Unified Supabase browser client for Vite/React app
// Adapts the requested abstraction to this project (no Next.js SSR here)
import { supabase } from '@/integrations/supabase/client';

export function getSupabaseBrowserClient() {
  return supabase;
}
