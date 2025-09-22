// Works in Vite/Next without depending on Node's process on the client.
export function getPublicEnv() {
  const isVite = typeof import.meta !== 'undefined' && !!(import.meta as any).env;
  const ve = isVite ? (import.meta as any).env : {};

  const url = (ve?.VITE_SUPABASE_URL as string) ||
              (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_URL : undefined);
  const anon = (ve?.VITE_SUPABASE_ANON_KEY as string) ||
               (ve?.VITE_SUPABASE_PUBLISHABLE_KEY as string) || // Legacy fallback
               (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : undefined);
  const debug = (ve?.VITE_DEBUG_HEALTH as string) ||
                (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_DEBUG_HEALTH : undefined);

  const missing = !url || !anon;
  return { 
    url, 
    anon, 
    missing,
    debugHealth: `${debug}` === 'true' || (isVite && ve?.DEV), // Enable debug in development by default
    isProd: isVite ? !ve?.DEV : (typeof process !== 'undefined' ? process.env.NODE_ENV === 'production' : true)
  };
}