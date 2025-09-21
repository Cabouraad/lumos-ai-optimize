import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient, getSupabaseBootError } from '@/lib/supabase/browser';
import { getPublicEnv } from '@/lib/env/browserEnv';

export function SupabaseHealth() {
  const { debugHealth } = getPublicEnv();
  const [msg, setMsg] = useState<string | null>(null);
  const [status, setStatus] = useState<'checking' | 'ok' | 'failed'>('checking');

  useEffect(() => {
    if (!debugHealth) return;
    
    const checkHealth = async () => {
      setStatus('checking');
      setMsg('Health: Testing connectivity...');
      
      // First check for boot errors
      const bootError = getSupabaseBootError();
      if (bootError) {
        setMsg(`Health: Boot Error – ${bootError}`);
        setStatus('failed');
        return;
      }

      try {
        const supabase = getSupabaseBrowserClient();
        const startTime = Date.now();
        
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout (10s)')), 10000)
        );
        
        const healthPromise = supabase
          .from('prompts')
          .select('id', { head: true, count: 'exact' })
          .limit(1);

        const { error, count } = await Promise.race([healthPromise, timeoutPromise]) as any;
        const duration = Date.now() - startTime;

        if (error) {
          // Provide specific guidance based on error type
          let guidance = '';
          if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
            guidance = ' → Check network connection & CORS settings';
          } else if (error.code === '401' || error.code === '403') {
            guidance = ' → Check auth permissions & RLS policies';
          } else if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
            guidance = ' → Table missing, check DB schema';
          } else if (error.message?.includes('SSL')) {
            guidance = ' → SSL/TLS connection issue';
          }
          
          setMsg(`Health: ✗ Error ${error.code || 'N/A'} – ${error.message}${guidance}`);
          setStatus('failed');
        } else {
          setMsg(`Health: ✓ Connected (${duration}ms, ${count ?? 'n/a'} prompts)`);
          setStatus('ok');
        }
      } catch (e: any) {
        const errorMsg = e?.message || e?.toString() || 'Unknown error';
        let guidance = '';
        
        if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
          guidance = ' → Check network connection & firewall';
        } else if (errorMsg.includes('timeout')) {
          guidance = ' → Server may be down or overloaded';
        } else if (errorMsg.includes('DNS') || errorMsg.includes('ENOTFOUND')) {
          guidance = ' → Check Supabase URL configuration';
        } else if (errorMsg.includes('CORS')) {
          guidance = ' → Configure CORS in Supabase dashboard';
        } else if (errorMsg.includes('process is not defined')) {
          guidance = ' → Environment variable access issue';
        }
        
        setMsg(`Health: ✗ ${errorMsg}${guidance}`);
        setStatus('failed');
      }
    };
    
    checkHealth();
  }, [debugHealth]);

  if (!debugHealth || !msg) return null;
  
  // Color code based on status
  const bgColor = status === 'ok' 
    ? 'rgba(34,197,94,.9)'   // green for success
    : status === 'failed' 
    ? 'rgba(239,68,68,.9)'   // red for failure  
    : 'rgba(59,130,246,.9)'; // blue for checking
  
  return (
    <div 
      style={{
        position: 'fixed',
        bottom: 8,
        right: 8,
        background: bgColor,
        color: '#fff',
        padding: '8px 12px',
        borderRadius: 8,
        fontSize: 12,
        zIndex: 9999,
        fontFamily: 'monospace',
        maxWidth: '400px',
        wordWrap: 'break-word',
        border: '1px solid rgba(255,255,255,.2)',
        boxShadow: '0 2px 10px rgba(0,0,0,.3)'
      }}
    >
      {msg}
    </div>
  );
}