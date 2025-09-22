'use client';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

// Monkey-patch common refresh sources in DEV to capture callers + stacks
export function RefreshDetector() {
  const location = useLocation();
  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    if (import.meta.env.PROD) return;

    const log = (label: string) => {
      const stack = new Error().stack?.split('\n').slice(2,7).join('\n') ?? '<no stack>';
      // eslint-disable-next-line no-console
      console.warn(`[RefreshDetector] ${label}\n${stack}`);
      setEvents((e) => [...e.slice(-6), label]);
    };

    // 1) Hard reloads
    const origReload = window.location.reload;
    // @ts-ignore
    window.location.reload = function(...args: any[]) {
      log('location.reload() called');
      // @ts-ignore
      return origReload.apply(this, args);
    };

    // 2) History API (router navigation)
    const origPushState = history.pushState;
    history.pushState = function(...args: any[]) {
      log('history.pushState()');
      return origPushState.apply(this, args as any);
    };
    const origReplaceState = history.replaceState;
    history.replaceState = function(...args: any[]) {
      log('history.replaceState()');
      return origReplaceState.apply(this, args as any);
    };

    // 3) Visibility/focus listeners that might call a reload/refresh
    const focus = () => log('window.focus event');
    const vis = () => document.visibilityState === 'visible' && log('document.visibilitychange→visible');
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', vis);

    return () => {
      window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', vis);
      // restore (best-effort)
      window.location.reload = origReload;
      history.pushState = origPushState;
      history.replaceState = origReplaceState;
    };
  }, [location.pathname]);

  if (import.meta.env.PROD) return null;

  return (
    <div style={{
      position:'fixed', bottom:8, left:8, zIndex:9999,
      background:'rgba(17,24,39,.85)', color:'#fff', padding:'6px 10px',
      borderRadius:8, fontSize:12, maxWidth:480
    }}>
      RefreshDetector active. Events: {events.join(' → ')}
    </div>
  );
}