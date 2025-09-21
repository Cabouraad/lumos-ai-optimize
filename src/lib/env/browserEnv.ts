// Works in both Next and Vite without touching Node's process in the browser
export function getPublicEnv() {
  const isVite = typeof import.meta !== 'undefined' && !!(import.meta as any).env;
  const vite = isVite ? (import.meta as any).env : {};
  
  const url =
    (vite?.VITE_SUPABASE_URL as string) ||
    (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_URL : undefined);
  const anon =
    (vite?.VITE_SUPABASE_ANON_KEY as string) ||
    (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : undefined);
  const debug =
    (vite?.VITE_DEBUG_HEALTH as string) ||
    (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_DEBUG_HEALTH : undefined);

  return {
    url,
    anon,
    debugHealth: `${debug}` === 'true',
    isProd: isVite ? !vite?.DEV : (typeof process !== 'undefined' ? process.env.NODE_ENV === 'production' : true),
  };
}