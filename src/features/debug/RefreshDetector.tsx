'use client';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

// Monkey-patch common refresh sources in DEV to capture callers + stacks
export function RefreshDetector() {
  const location = useLocation();
  const [events, setEvents] = useState<string[]>([]);
  const [patches, setPatches] = useState<string[]>([]);

  useEffect(() => {
    if (import.meta.env.PROD) return;

    const activePatchList: string[] = [];

    const log = (label: string) => {
      const stack = new Error().stack?.split('\n').slice(2,7).join('\n') ?? '<no stack>';
      // eslint-disable-next-line no-console
      console.warn(`[RefreshDetector] ${label}\n${stack}`);
      setEvents((e) => [...e.slice(-6), label]);
    };

    // 1) Try to patch hard reloads safely
    try {
      const origReload = window.location.reload;
      const patchedReload = function(...args: any[]) {
        log('location.reload() called');
        // @ts-ignore
        return origReload.apply(this, args);
      };
      
      try {
        // @ts-ignore
        window.location.reload = patchedReload;
        activePatchList.push('reload');
      } catch {
        // Fallback with Object.defineProperty
        Object.defineProperty(window.location, 'reload', {
          value: patchedReload,
          writable: false,
          configurable: true
        });
        activePatchList.push('reload-fallback');
      }
    } catch (e) {
      console.warn('[RefreshDetector] Could not patch location.reload:', e);
    }

    // 2) Try to patch History API safely
    try {
      const origPushState = history.pushState;
      history.pushState = function(...args: any[]) {
        log('history.pushState()');
        return origPushState.apply(this, args as any);
      };
      activePatchList.push('pushState');
    } catch (e) {
      console.warn('[RefreshDetector] Could not patch history.pushState:', e);
    }

    try {
      const origReplaceState = history.replaceState;
      history.replaceState = function(...args: any[]) {
        log('history.replaceState()');
        return origReplaceState.apply(this, args as any);
      };
      activePatchList.push('replaceState');
    } catch (e) {
      console.warn('[RefreshDetector] Could not patch history.replaceState:', e);
    }

    // 3) Event listeners (these should always work)
    const focus = () => log('window.focus event');
    const vis = () => document.visibilityState === 'visible' && log('document.visibilitychange→visible');
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', vis);
    activePatchList.push('events');

    setPatches(activePatchList);

    return () => {
      window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [location.pathname]);

  if (import.meta.env.PROD) return null;

  return (
    <div style={{
      position:'fixed', bottom:8, left:8, zIndex:9999,
      background:'rgba(17,24,39,.85)', color:'#fff', padding:'6px 10px',
      borderRadius:8, fontSize:12, maxWidth:480
    }}>
      <div>RefreshDetector active. Patches: {patches.join(', ')}</div>
      <div>Events: {events.join(' → ')}</div>
    </div>
  );
}