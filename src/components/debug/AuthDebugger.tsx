import { useAuth } from '@/contexts/AuthContext';
import { getPublicEnv } from '@/lib/env/browserEnv';

export function AuthDebugger() {
  const { ready, user, loading, subscriptionLoading } = useAuth();
  const { debugHealth } = getPublicEnv();

  if (!debugHealth) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 8,
      right: 8,
      background: 'rgba(17,24,39,.9)',
      color: '#fff',
      padding: '8px 12px',
      borderRadius: 8,
      fontSize: 11,
      fontFamily: 'monospace',
      zIndex: 9998,
      maxWidth: '300px',
      border: '1px solid rgba(255,255,255,.2)'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Auth Debug</div>
      <div>Ready: {ready ? '✓' : '✗'}</div>
      <div>User: {user ? '✓' : '✗'}</div>
      <div>Loading: {loading ? '⏳' : '✓'}</div>
      <div>Sub Loading: {subscriptionLoading ? '⏳' : '✓'}</div>
      <div style={{ fontSize: '10px', marginTop: '4px', opacity: 0.8 }}>
        Time: {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
}