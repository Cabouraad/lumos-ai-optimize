import { getPublicEnv } from '@/lib/env/browserEnv';

export function getBrowserEnv() {
  const { url, anon } = getPublicEnv();
  
  if (!/^https:\/\//.test(url)) {
    console.warn('Supabase URL is not https:// — mixed content may block requests in production.');
  }
  
  return { url, anon };
}