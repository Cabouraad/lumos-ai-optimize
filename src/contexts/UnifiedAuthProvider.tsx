import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { clearOrgIdCache, updateOrgIdCache } from '@/lib/org-id';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface UserData {
  id: string;
  email: string;
  role: string;
  org_id: string | null;
  created_at: string;
  tour_completions?: Record<string, boolean>;
  organizations: {
    id: string;
    name: string;
    domain: string;
    plan_tier: string;
  } | null;
}

interface SubscriptionData {
  subscribed: boolean;
  subscription_tier: string;
  subscription_end: string | null;
  trial_expires_at: string | null;
  trial_started_at: string | null;
  payment_collected: boolean;
  metadata: any;
}

interface UnifiedAuthContextType {
  // Auth state
  user: User | null;
  session: Session | null;
  loading: boolean;
  ready: boolean;
  signOut: () => Promise<void>;
  
  // User data
  userData: UserData | null;
  userLoading: boolean;
  userError: string | null;
  userReady: boolean;
  refreshUserData: () => Promise<void>;
  
  // Subscription data
  subscriptionData: SubscriptionData | null;
  subscriptionLoading: boolean;
  subscriptionError: string | null;
  hasAccess: boolean;
  refreshSubscription: () => Promise<void>;
  
  // Org ID (eliminates need for getOrgId calls)
  orgId: string | null;
}

const UnifiedAuthContext = createContext<UnifiedAuthContextType>({
  user: null,
  session: null,
  loading: true,
  ready: false,
  signOut: async () => {},
  userData: null,
  userLoading: false,
  userError: null,
  userReady: false,
  refreshUserData: async () => {},
  subscriptionData: null,
  subscriptionLoading: false,
  subscriptionError: null,
  hasAccess: false,
  refreshSubscription: async () => {},
  orgId: null,
});

// ============================================================================
// INDIVIDUAL HOOKS (Backward Compatible)
// ============================================================================

export const useAuth = () => {
  const context = useContext(UnifiedAuthContext);
  if (!context) {
    throw new Error('useAuth must be used within UnifiedAuthProvider');
  }
  return {
    user: context.user,
    session: context.session,
    loading: context.loading,
    ready: context.ready,
    signOut: context.signOut,
  };
};

export const useUser = () => {
  const context = useContext(UnifiedAuthContext);
  if (!context) {
    throw new Error('useUser must be used within UnifiedAuthProvider');
  }
  return {
    userData: context.userData,
    loading: context.userLoading,
    error: context.userError,
    ready: context.userReady,
    refreshUserData: context.refreshUserData,
  };
};

export const useSubscription = () => {
  const context = useContext(UnifiedAuthContext);
  if (!context) {
    throw new Error('useSubscription must be used within UnifiedAuthProvider');
  }
  return {
    subscriptionData: context.subscriptionData,
    loading: context.subscriptionLoading,
    error: context.subscriptionError,
    hasAccess: context.hasAccess,
    refreshSubscription: context.refreshSubscription,
  };
};

export const useOrgId = () => {
  const context = useContext(UnifiedAuthContext);
  if (!context) {
    throw new Error('useOrgId must be used within UnifiedAuthProvider');
  }
  return context.orgId;
};

// ============================================================================
// UNIFIED AUTH PROVIDER
// ============================================================================

interface UnifiedAuthProviderProps {
  children: React.ReactNode;
}

export function UnifiedAuthProvider({ children }: UnifiedAuthProviderProps) {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  
  // User data state
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [userError, setUserError] = useState<string | null>(null);
  const [userReady, setUserReady] = useState(false);
  
  // Subscription state
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [autoVerifiedOnce, setAutoVerifiedOnce] = useState(false);
  
  // Org ID state (derived from userData)
  const [orgId, setOrgId] = useState<string | null>(null);

  // ============================================================================
  // BATCHED DATA FETCHING (Single API Call)
  // ============================================================================
  
  const fetchAllUserData = useCallback(async () => {
    if (!user) {
      setUserData(null);
      setUserError(null);
      setUserLoading(false);
      setUserReady(true);
      setSubscriptionData(null);
      setSubscriptionError(null);
      setOrgId(null);
      return;
    }

    setUserLoading(true);
    setSubscriptionLoading(true);
    setUserError(null);
    setSubscriptionError(null);

    try {
      console.log('[UnifiedAuthProvider] Fetching all user data in single batch for:', user.email);
      
      // OPTIMIZATION: Make ONE batched API call instead of three sequential calls
      const [
        { error: ensureError },
        { data: userDataResult, error: userDataError },
        { data: subscriptionResult, error: subscriptionRpcError }
      ] = await Promise.all([
        supabase.functions.invoke('ensure-user-record'),
        supabase
          .from('users')
          .select(`
            id,
            email,
            role,
            org_id,
            created_at,
            tour_completions,
            organizations (
              id,
              name,
              domain,
              plan_tier
            )
          `)
          .eq('id', user.id)
          .single(),
        supabase.rpc('get_user_subscription_status')
      ]);

      // Handle ensure-user-record errors (non-critical)
      if (ensureError) {
        console.warn('[UnifiedAuthProvider] Ensure user record failed:', ensureError);
      }

      // Process user data
      if (userDataError) {
        throw new Error(`Failed to fetch user data: ${userDataError.message}`);
      }

      if (!userDataResult) {
        throw new Error('User not found in database');
      }

      const fetchedUserData = userDataResult as UserData;
      setUserData(fetchedUserData);
      setUserError(null);
      
      // Update org ID cache if available
      if (fetchedUserData.org_id) {
        setOrgId(fetchedUserData.org_id);
        updateOrgIdCache(fetchedUserData.org_id);
      } else {
        setOrgId(null);
      }

      // Process subscription data
      const subscriberData = subscriptionResult as {
        subscribed: boolean;
        subscription_tier: string;
        subscription_end: string | null;
        trial_expires_at: string | null;
        trial_started_at: string | null;
        payment_collected: boolean;
      } | null;

      const orgPlanTier = (fetchedUserData.organizations as any)?.plan_tier ?? null;

      let finalSubscriptionData: SubscriptionData;

      if (subscriptionRpcError) {
        console.warn('[UnifiedAuthProvider] Error fetching subscription:', subscriptionRpcError);
        finalSubscriptionData = {
          subscribed: false,
          subscription_tier: 'free',
          subscription_end: null,
          trial_expires_at: null,
          trial_started_at: null,
          payment_collected: false,
          metadata: null
        };
      } else if (subscriberData) {
        const hasActivePaidSubscription = subscriberData.subscribed && 
          subscriberData.subscription_tier && 
          subscriberData.subscription_tier !== 'free';
        
        finalSubscriptionData = {
          subscribed: subscriberData.subscribed || false,
          subscription_tier: hasActivePaidSubscription 
            ? subscriberData.subscription_tier 
            : (orgPlanTier ?? subscriberData.subscription_tier ?? 'free'),
          subscription_end: subscriberData.subscription_end,
          trial_expires_at: subscriberData.trial_expires_at,
          trial_started_at: subscriberData.trial_started_at,
          payment_collected: subscriberData.payment_collected || false,
          metadata: null
        };
      } else {
        finalSubscriptionData = {
          subscribed: false,
          subscription_tier: 'free',
          subscription_end: null,
          trial_expires_at: null,
          trial_started_at: null,
          payment_collected: false,
          metadata: null
        };
      }

      console.log('[UnifiedAuthProvider] Batched data fetch complete:', {
        hasUserData: !!fetchedUserData,
        orgId: fetchedUserData.org_id,
        tier: finalSubscriptionData.subscription_tier,
        subscribed: finalSubscriptionData.subscribed,
        payment_collected: finalSubscriptionData.payment_collected
      });

      setSubscriptionData(finalSubscriptionData);
      setSubscriptionError(null);

    } catch (err) {
      console.error('[UnifiedAuthProvider] Error fetching user data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load user data';
      
      // Detect auth-related errors (permission denied, invalid token, session not found)
      const isAuthError = errorMessage.includes('permission denied') ||
        errorMessage.includes('42501') ||
        errorMessage.includes('Invalid token') ||
        errorMessage.includes('session_not_found') ||
        errorMessage.includes('Unauthorized');
      
      if (isAuthError) {
        console.warn('[UnifiedAuthProvider] Auth error detected, clearing session');
        try {
          localStorage.removeItem('sb-cgocsffxqyhojtyzniyz-auth-token');
        } catch (e) {
          // Ignore storage errors
        }
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        clearOrgIdCache();
      }
      
      setUserError(errorMessage);
      setUserData(null);
      setOrgId(null);
      
      // Set free tier defaults on error
      setSubscriptionData({
        subscribed: false,
        subscription_tier: 'free',
        subscription_end: null,
        trial_expires_at: null,
        trial_started_at: null,
        payment_collected: false,
        metadata: null
      });
    } finally {
      setUserLoading(false);
      setUserReady(true);
      setSubscriptionLoading(false);
    }
  }, [user?.id]);

  // ============================================================================
  // AUTH INITIALIZATION
  // ============================================================================

  useEffect(() => {
    let isMounted = true;

    const clearInvalidSession = async () => {
      console.warn('[UnifiedAuthProvider] Clearing invalid session from storage');
      // Explicitly clear localStorage to prevent stale token usage
      try {
        localStorage.removeItem('sb-cgocsffxqyhojtyzniyz-auth-token');
      } catch (e) {
        console.warn('[UnifiedAuthProvider] Could not clear localStorage:', e);
      }
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      clearOrgIdCache();
    };

    const initializeAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        // Handle session retrieval errors (session_not_found, etc.)
        if (sessionError) {
          console.warn('[UnifiedAuthProvider] Session error:', sessionError.message);
          await clearInvalidSession();
          return;
        }
        
        if (session) {
          // Validate session against server - this catches stale/expired sessions
          const { data: { user }, error } = await supabase.auth.getUser();
          
          if (error || !user) {
            console.warn('[UnifiedAuthProvider] Session invalid, clearing:', error?.message);
            await clearInvalidSession();
          } else {
            setSession(session);
            setUser(user);
          }
        } else {
          setSession(null);
          setUser(null);
        }
      } catch (error) {
        console.error('[UnifiedAuthProvider] Error getting initial session:', error);
        await clearInvalidSession();
      } finally {
        if (isMounted) {
          setLoading(false);
          setReady(true);
        }
      }
    };

    // Set up auth state change listener
    let tokenRefreshTimeout: NodeJS.Timeout | null = null;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;
        
        console.log('[UnifiedAuthProvider] Auth state change:', event, !!session);
        
        if (event === 'SIGNED_OUT') {
          clearOrgIdCache();
        }
        
        if (event === 'TOKEN_REFRESHED' && tokenRefreshTimeout) {
          return;
        }
        
        if (event === 'TOKEN_REFRESHED') {
          tokenRefreshTimeout = setTimeout(() => {
            tokenRefreshTimeout = null;
          }, 2000);
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!ready && (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED')) {
          setReady(true);
          setLoading(false);
        }
      }
    );

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [ready]);

  // Fetch all user data when auth is ready
  useEffect(() => {
    if (ready) {
      fetchAllUserData();
    }
  }, [ready, fetchAllUserData]);

  // ============================================================================
  // SUBSCRIPTION ACCESS CALCULATION
  // ============================================================================

  // SECURITY: Access granted if:
  // 1. User has active paid subscription (subscribed=true with a paid tier)
  // 2. OR user is on active trial WITH payment method collected
  // 3. OR user is on Free tier (limited access but valid)
  const hasAccess = subscriptionData ? (
    // Active paid subscription - subscribed flag is set by Stripe sync or manual override
    (subscriptionData.subscribed === true && 
      subscriptionData.subscription_tier && 
      subscriptionData.subscription_tier !== 'free') ||
    // Active trial with payment collected (security requirement for trials)
    (subscriptionData.trial_expires_at &&
      new Date(subscriptionData.trial_expires_at) > new Date() &&
      subscriptionData.payment_collected === true) ||
    // Free tier users have limited access but can still use the dashboard
    (subscriptionData.subscription_tier === 'free')
  ) : false;

  // Auto-verify subscription once for users who completed checkout
  useEffect(() => {
    const run = async () => {
      try {
        console.log('[UnifiedAuthProvider] Auto-verifying subscription via edge function');
        await supabase.functions.invoke('check-subscription');
        await fetchAllUserData();
      } catch (e) {
        console.error('[UnifiedAuthProvider] Auto verification failed', e);
      }
    };

    if (ready && user && !userLoading && !hasAccess && !autoVerifiedOnce) {
      setAutoVerifiedOnce(true);
      run();
    }
  }, [ready, user, userLoading, hasAccess, autoVerifiedOnce, fetchAllUserData]);

  // ============================================================================
  // SIGN OUT
  // ============================================================================

  const signOut = useCallback(async () => {
    try {
      clearOrgIdCache();
      sessionStorage.removeItem('onboarding-data');
      sessionStorage.removeItem('selected-plan');
      sessionStorage.removeItem('billing-cycle');
      await supabase.auth.signOut();
    } catch (error) {
      console.error('[UnifiedAuthProvider] Error signing out:', error);
    }
  }, []);

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const value: UnifiedAuthContextType = {
    user,
    session,
    loading,
    ready,
    signOut,
    userData,
    userLoading,
    userError,
    userReady,
    refreshUserData: fetchAllUserData,
    subscriptionData,
    subscriptionLoading,
    subscriptionError,
    hasAccess,
    refreshSubscription: fetchAllUserData,
    orgId,
  };

  return (
    <UnifiedAuthContext.Provider value={value}>
      {children}
    </UnifiedAuthContext.Provider>
  );
}
