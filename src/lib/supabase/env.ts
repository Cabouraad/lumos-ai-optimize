import { getPublicEnv } from '@/lib/env/browserEnv';

export function getBrowserEnv() {
  const { url, anon, missing } = getPublicEnv();
  if (missing) {
    // return placeholders; caller will render a banner instead of crashing
    return { url: '', anon: '' } as any;
  }
  
  if (!/^https:\/\//.test(url)) {
    console.warn('Supabase URL is not https:// — mixed content may block requests in production.');
  }
  
  return { url, anon };
}