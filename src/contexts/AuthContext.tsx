/**
 * @deprecated Legacy AuthContext - redirects to new modular auth system
 * Use specific hooks instead: useAuthNew, useUser, useSubscription, usePermissions
 */

// Re-export new auth hooks with backward compatibility
export { useAuth as useAuthNew } from './AuthProvider';
export { useUser } from './UserProvider';
export { useSubscription } from './SubscriptionProvider';
export { usePermissions } from '../hooks/usePermissions';

// Legacy combined hook for maximum backward compatibility
import { useAuth as useAuthNew } from './AuthProvider';
import { useUser } from './UserProvider';
import { useSubscription } from './SubscriptionProvider';
import { useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';

// Legacy interface for backward compatibility
interface LegacyAuthContextType {
  user: User | null;
  session: Session | null;
  orgData: any;
  orgStatus: 'loading' | 'success' | 'error' | 'not_found';
  subscriptionData: any;
  loading: boolean;
  subscriptionLoading: boolean;
  ready: boolean;
  isChecking: boolean;
  subscriptionError: string | null;
  checkSubscription: () => Promise<void>;
  signOut: () => Promise<void>;
}

export function useAuthLegacy(): LegacyAuthContextType {
  const { user, session, loading: authLoading, ready, signOut } = useAuthNew();
  const { userData, loading: userLoading, error: userError, ready: userReady, refreshUserData } = useUser();
  const { subscriptionData, loading: subscriptionLoading, error: subscriptionError, hasAccess, refreshSubscription } = useSubscription();

  // Map to legacy format with defensive orgStatus calculation
  const legacyData = useMemo((): LegacyAuthContextType => {
    // Determine orgStatus defensively to prevent race conditions
    let orgStatus: 'loading' | 'success' | 'error' | 'not_found';
    
    if (userError) {
      orgStatus = 'error';
    } else if (!userReady || userLoading) {
      // Still loading - don't report 'not_found' yet
      orgStatus = 'loading';
    } else if (userData) {
      orgStatus = 'success';
    } else {
      // Only report 'not_found' after we're ready and confirmed no data
      orgStatus = 'not_found';
    }
    
    return {
      user,
      session,
      orgData: userData,
      orgStatus,
      subscriptionData: subscriptionData ? {
        ...subscriptionData,
        requires_subscription: !hasAccess
      } : null,
      loading: authLoading,
      subscriptionLoading,
      ready: ready && userReady,
      isChecking: userLoading || subscriptionLoading,
      subscriptionError,
      checkSubscription: async () => {
        await refreshUserData();
        await refreshSubscription();
      },
      signOut
    };
  }, [
    user, session, userData, userError, userLoading, userReady, subscriptionData, 
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