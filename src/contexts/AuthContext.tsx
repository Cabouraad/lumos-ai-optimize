/**
 * @deprecated Legacy AuthContext - now uses UnifiedAuthProvider
 * Use specific hooks instead: useAuth, useUser, useSubscription, usePermissions
 */

// Import hooks with aliases to avoid conflicts
import { 
  useAuth as useAuthBase,
  useUser as useUserBase, 
  useSubscription as useSubscriptionBase 
} from './UnifiedAuthProvider';
import { useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';

// Re-export individual hooks
export { useUser, useSubscription, useOrgId } from './UnifiedAuthProvider';
export { usePermissions } from '../hooks/usePermissions';

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
  const { user, session, loading: authLoading, ready, signOut } = useAuthBase();
  const { userData, loading: userLoading, error: userError, ready: userReady, refreshUserData } = useUserBase();
  const { subscriptionData, loading: subscriptionLoading, error: subscriptionError, hasAccess, refreshSubscription } = useSubscriptionBase();

  // Map to legacy format with defensive orgStatus calculation
  const legacyData = useMemo((): LegacyAuthContextType => {
    // Determine orgStatus defensively to prevent race conditions
    let orgStatus: 'loading' | 'success' | 'error' | 'not_found';
    
    if (userError) {
      orgStatus = 'error';
    } else if (!userReady || userLoading) {
      // Still loading - don't report 'not_found' yet
      orgStatus = 'loading';
    } else if (userData && userData.org_id) {
      // User exists AND has an organization
      orgStatus = 'success';
    } else {
      // User ready but no userData OR userData exists but no org_id
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

// For maximum compatibility, export useAuth as the legacy version with proper typing
export function useAuth(): LegacyAuthContextType {
  return useAuthLegacy();
}

// Export legacy context and provider (empty implementations for compatibility)
export const AuthContext = null;
export const AuthProvider = ({ children }: { children: React.ReactNode }) => children;