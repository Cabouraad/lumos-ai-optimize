import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

export function QueryAuthBridge() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const { user } = useAuth();

  useEffect(() => {
    // Invalidate queries whenever the session/user changes
    // This covers SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED
    qc.invalidateQueries();
  }, [qc, session?.access_token, user?.id]);

  return null;
}
