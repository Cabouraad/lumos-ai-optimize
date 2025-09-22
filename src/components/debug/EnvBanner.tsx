'use client';
import { useEffect, useState } from 'react';
import { getSupabaseBootError } from '@/lib/supabase/browser';
import { getPublicEnv } from '@/lib/env/browserEnv';

export function EnvBanner() {
  const { usingFallbacks } = getPublicEnv();
  const bootErr = getSupabaseBootError();
  const [networkStatus, setNetworkStatus] = useState<'unknown' | 'checking' | 'failed' | 'ok'>('unknown');

  // Test basic network connectivity to distinguish env vs network issues
  useEffect(() => {
    if (bootErr) return;
    
    setNetworkStatus('checking');
    
    // Test basic network connectivity with a simple request
    fetch('https://cgocsffxqyhojtyzniyz.supabase.co/rest/v1/', {
      method: 'HEAD',
      mode: 'no-cors' // Bypass CORS for basic connectivity test
    }).then(() => {
      setNetworkStatus('ok');
    }).catch(() => {
      setNetworkStatus('failed');
    });
  }, [usingFallbacks, bootErr]);

  // Don't show banner if everything is OK
  if (!bootErr && networkStatus === 'ok') return null;

  let msg = '';
  let bgColor = '#B91C1C'; // default red
  
  if (bootErr) {
    if (bootErr.includes('Missing VITE_SUPABASE')) {
      msg = `Environment configuration error: ${bootErr}. Add missing secrets in Lovable.`;
    } else {
      msg = `Supabase initialization error: ${bootErr}`;
    }
  } else if (networkStatus === 'failed') {
    msg = 'Network connectivity issue detected. Cannot reach Supabase servers. Check your internet connection and firewall settings.';
    bgColor = '#D97706'; // orange for network issues
  } else if (networkStatus === 'checking') {
    msg = 'Testing network connectivity to Supabase...';
    bgColor = '#2563EB'; // blue for checking
  }

  return (
    <div style={{
      position:'fixed', bottom:8, left:8, right:8, zIndex:9999,
      background: bgColor, color:'#fff', padding:'10px 12px',
      borderRadius:8, fontSize:12, boxShadow:'0 2px 10px rgba(0,0,0,.2)',
      maxWidth: '100%', wordWrap: 'break-word'
    }}>
      {msg}
    </div>
  );
}