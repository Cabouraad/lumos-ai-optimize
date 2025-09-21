import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { getPublicEnv } from '@/lib/env/browserEnv';

export function SupabaseHealth() {
  const { debugHealth } = getPublicEnv();
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!debugHealth) return;
    
    const checkHealth = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const startTime = Date.now();
        
        // HEAD count ping against a lightweight table that exists in all envs
        const { error, count } = await supabase
          .from('prompts')
          .select('id', { head: true, count: 'exact' })
          .limit(1);

        const duration = Date.now() - startTime;

        if (error) {
          // Common actionable hints:
          // - 401/403 => auth/RLS/grants  
          // - fetch failed => wrong URL / CORS / http vs https
          let hint = '';
          if (error.code === '401' || error.code === '403') {
            hint = ' (auth/RLS issue)';
          } else if (error.message?.includes('fetch')) {
            hint = ' (network/CORS issue)';
          }
          setMsg(`Health: error ${error.code || ''} – ${error.message}${hint}`);
        } else {
          setMsg(`Health: OK (${duration}ms, rows: ${count ?? 'n/a'})`);
        }
      } catch (e: any) {
        const errorMsg = (e?.message || e).toString();
        let hint = '';
        if (errorMsg.includes('Failed to fetch')) {
          hint = ' – check network/CORS/URL';
        } else if (errorMsg.includes('process is not defined')) {
          hint = ' – env access issue';
        }
        setMsg(`Health: fetch failed${hint} – ${errorMsg}`);
      }
    };
    
    checkHealth();
  }, [debugHealth]);

  if (!debugHealth || !msg) return null;
  
  return (
    <div 
      style={{
        position: 'fixed',
        bottom: 8,
        right: 8,
        background: 'rgba(17,24,39,.8)',
        color: '#fff',
        padding: '6px 10px',
        borderRadius: 8,
        fontSize: 12,
        zIndex: 9999,
        fontFamily: 'monospace',
        maxWidth: '300px',
        wordWrap: 'break-word'
      }}
    >
      {msg}
    </div>
  );
}