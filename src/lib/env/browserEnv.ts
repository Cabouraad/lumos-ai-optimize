// Centralized environment detection with proper fallback handling
export function getPublicEnv() {
  const ve = (import.meta as any)?.env || {};

  const url = ve?.VITE_SUPABASE_URL as string;
  const anon = ve?.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const debug = ve?.VITE_DEBUG_HEALTH as string;

  // Production fallbacks - these are the actual working values for this project
  const fallbackUrl = 'https://cgocsffxqyhojtyzniyz.supabase.co';
  const fallbackAnon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk';

  const effectiveUrl = url || fallbackUrl;
  const effectiveAnon = anon || fallbackAnon;

  const hasEnvVars = !!(url && anon);
  
  // Only show fallback warning if we're NOT using the known-good project values
  const usingKnownGoodProject = effectiveUrl === fallbackUrl && effectiveAnon === fallbackAnon;
  const usingFallbacks = !hasEnvVars && !usingKnownGoodProject;

  return { 
    url: effectiveUrl, 
    anon: effectiveAnon, 
    missing: false, // Never "missing" since we have fallbacks
    usingFallbacks,
    hasEnvVars,
    debugHealth: debug === 'true' || ve?.DEV,
    isProd: !ve?.DEV
  };
}