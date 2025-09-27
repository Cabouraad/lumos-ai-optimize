/**
 * @deprecated Legacy AuthContext - redirects to new modular auth system
 * Use specific hooks instead: useAuth, useUser, useSubscription, usePermissions
 */

// Re-export new auth hooks with backward compatibility
export { useAuth } from './AuthProvider';
export { useUser } from './UserProvider';
export { useSubscription } from './SubscriptionProvider';
export { usePermissions } from '../hooks/usePermissions';

// Legacy combined hook for maximum backward compatibility
import { useAuth as useAuthNew } from './AuthProvider';
import { useUser } from './UserProvider';
import { useSubscription } from './SubscriptionProvider';
import { useMemo } from 'react';

export function useAuthLegacy() {
  const { user, session, loading: authLoading, ready, signOut } = useAuthNew();
  const { userData, loading: userLoading, error: userError, refreshUserData } = useUser();
  const { subscriptionData, loading: subscriptionLoading, error: subscriptionError, hasAccess, refreshSubscription } = useSubscription();

  // Map to legacy format
  const legacyData = useMemo(() => ({
    user,
    session,
    orgData: userData,
    orgStatus: userError ? 'error' : 
               !userData && userLoading ? 'loading' :
               userData ? 'success' : 'not_found',
    subscriptionData: subscriptionData ? {
      ...subscriptionData,
      requires_subscription: !hasAccess
    } : null,
    loading: authLoading,
    subscriptionLoading,
    ready,
    isChecking: userLoading || subscriptionLoading,
    subscriptionError,
    checkSubscription: async () => {
      await refreshUserData();
      await refreshSubscription();
    },
    signOut
  }), [
    user, session, userData, userError, userLoading, subscriptionData, 
    subscriptionLoading, hasAccess, authLoading, ready, subscriptionError,
    refreshUserData, refreshSubscription, signOut
  ]);

  return legacyData;
}

// For maximum compatibility, export useAuth as the legacy version by default
// Individual files can import { useAuth as useAuthNew } from './AuthProvider' if needed
export { useAuthLegacy as useAuth };

// Export legacy context and provider (empty implementations for compatibility)
export const AuthContext = null;
export const AuthProvider = ({ children }: { children: React.ReactNode }) => children;