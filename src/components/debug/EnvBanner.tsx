'use client';
import { getSupabaseBootError } from '@/lib/supabase/browser';
import { getPublicEnv } from '@/lib/env/browserEnv';

export function EnvBanner() {
  const { missing } = getPublicEnv();
  const bootErr = getSupabaseBootError();
  if (!missing && !bootErr) return null;
  const msg = bootErr || 'Supabase env missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.';
  return (
    <div style={{
      position:'fixed', bottom:8, left:8, right:8, zIndex:9999,
      background:'#B91C1C', color:'#fff', padding:'10px 12px',
      borderRadius:8, fontSize:12, boxShadow:'0 2px 10px rgba(0,0,0,.2)'
    }}>
      {msg}
    </div>
  );
}