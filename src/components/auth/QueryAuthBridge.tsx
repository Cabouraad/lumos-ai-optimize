import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/UnifiedAuthProvider';

export function QueryAuthBridge() {
  const qc = useQueryClient();
  const { session, user } = useAuth();
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const currentUserId = user?.id || null;
    const prevUserId = prevUserIdRef.current;

    // Only invalidate on true user changes (login/logout), not token refreshes
    if (currentUserId !== prevUserId) {
      console.log('[QueryAuthBridge] User changed, invalidating queries:', { prevUserId, currentUserId });
      qc.invalidateQueries();
      prevUserIdRef.current = currentUserId;
    }
  }, [qc, user?.id]);

  return null;
}
