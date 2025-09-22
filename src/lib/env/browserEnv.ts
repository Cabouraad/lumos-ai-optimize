// Simplified environment detection for Vite-based projects
export function getPublicEnv() {
  const ve = (import.meta as any)?.env || {};

  const url = ve?.VITE_SUPABASE_URL as string;
  const anon = ve?.VITE_SUPABASE_ANON_KEY as string;
  const debug = ve?.VITE_DEBUG_HEALTH as string;

  const missing = !url || !anon;
  return { 
    url, 
    anon, 
    missing,
    debugHealth: debug === 'true' || ve?.DEV,
    isProd: !ve?.DEV
  };
}