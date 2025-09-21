import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

interface SupabaseHealthProps {
  show?: boolean;
}

export function SupabaseHealth({ show = import.meta.env.DEV }: SupabaseHealthProps) {
  const [msg, setMsg] = useState<string | null>(null);
  
  useEffect(() => {
    if (!show) return;
    
    const checkHealth = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const startTime = Date.now();
        
        // Try a simple health check - get session (doesn't require auth)
        const { error } = await supabase.auth.getSession();
        const duration = Date.now() - startTime;
        
        if (error) {
          setMsg(`Supabase auth error: ${error.message}`);
        } else {
          setMsg(`Supabase healthy (${duration}ms)`);
        }
      } catch (e: any) {
        const errorMsg = e?.message || String(e);
        if (errorMsg.includes('Failed to fetch')) {
          setMsg('Health check failed: Network/CORS issue - check console');
        } else {
          setMsg(`Health check failed: ${errorMsg}`);
        }
        console.error('Supabase health check error:', e);
      }
    };
    
    checkHealth();
  }, [show]);
  
  if (!show || !msg) return null;
  
  return (
    <div 
      style={{
        position: 'fixed',
        bottom: 8,
        right: 8,
        fontSize: 12,
        opacity: 0.6,
        backgroundColor: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '4px 8px',
        borderRadius: '4px',
        zIndex: 9999,
        fontFamily: 'monospace'
      }}
    >
      {msg}
    </div>
  );
}