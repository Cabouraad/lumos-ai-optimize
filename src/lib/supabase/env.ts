import { getPublicEnv } from '@/lib/env/browserEnv';

export function getBrowserEnv() {
  const { url, anon } = getPublicEnv();
  
  if (!url || !anon) {
    throw new Error(
      'Supabase browser env missing. Set NEXT_PUBLIC_SUPABASE_URL & NEXT_PUBLIC_SUPABASE_ANON_KEY or VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY.'
    );
  }
  
  if (!/^https:\/\//.test(url)) {
    console.warn('Supabase URL is not https:// — mixed content may block requests in production.');
  }
  
  return { url, anon };
}