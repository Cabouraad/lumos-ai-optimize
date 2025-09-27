import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { EdgeFunctionClient } from '@/lib/edge-functions/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  orgData: any | null;
  orgStatus: 'idle' | 'loading' | 'success' | 'not_found' | 'error';
  subscriptionData: {
    subscribed: boolean;
    subscription_tier: string | null;
    subscription_end: string | null;
    trial_expires_at?: string;
    trial_started_at?: string;
    payment_collected?: boolean;
    requires_subscription?: boolean;
    metadata?: any;
  } | null;
  loading: boolean;
  subscriptionLoading: boolean;
  ready: boolean;
  isChecking: boolean;
  subscriptionError: string | null;
  checkSubscription: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  orgData: null,
  orgStatus: 'idle',
  subscriptionData: null,
  loading: true,
  subscriptionLoading: false,
  ready: false,
  isChecking: false,
  subscriptionError: null,
  checkSubscription: async () => {},
  signOut: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [orgData, setOrgData] = useState<any | null>(null);
  const [orgStatus, setOrgStatus] = useState<'idle' | 'loading' | 'success' | 'not_found' | 'error'>('idle');
  const [subscriptionData, setSubscriptionData] = useState<{
    subscribed: boolean;
    subscription_tier: string | null;
    subscription_end: string | null;
    trial_expires_at?: string;
    trial_started_at?: string;
    payment_collected?: boolean;
    requires_subscription?: boolean;
    metadata?: any;
  } | null>(null);

  // Idempotent subscription check state
  const mountedRef = useRef(true);
  const subscriptionCheckTimeoutRef = useRef<NodeJS.Timeout>();
  const isCheckingRef = useRef(false);
  const requestIdRef = useRef(0);
  const lastSubscriptionCheckRef = useRef<number>(0);
  const [isChecking, setIsChecking] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);

  // Simplified subscription check with better error handling
  const checkSubscriptionStatusWithRetry = useCallback(async () => {
    if (!user || !user.email) {
      console.log('[AuthContext] No user available for subscription check');
      return;
    }

    // Prevent concurrent checks
    if (isCheckingRef.current) {
      console.log('[AuthContext] Subscription check already in progress, skipping');
      return;
    }

    isCheckingRef.current = true;
    setIsChecking(true);
    setSubscriptionLoading(true);
    setSubscriptionError(null);

    try {
      console.log('[AuthContext] Starting subscription check for user:', user.email);
      
      // Try edge function with simple timeout
      const checkPromise = supabase.functions.invoke('check-subscription');
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Edge function timeout')), 10000)
      );
      
      const { data, error } = await Promise.race([checkPromise, timeoutPromise]) as any;
      
      if (!error && data) {
        console.log('[AuthContext] Subscription check success:', {
          subscribed: data.subscribed,
          tier: data.subscription_tier
        });
        setSubscriptionData(data);
        setSubscriptionError(null);
        return;
      }
      
      // If edge function fails, try RPC fallback
      console.log('[AuthContext] Edge function failed, trying RPC fallback');
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_user_subscription_status');
      
      if (!rpcError && rpcData) {
        const normalizedData = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        const subscriptionResult = {
          subscribed: !!(normalizedData as any)?.subscribed,
          subscription_tier: (normalizedData as any)?.subscription_tier || 'starter',
          subscription_end: (normalizedData as any)?.subscription_end,
          trial_expires_at: (normalizedData as any)?.trial_expires_at,
          trial_started_at: (normalizedData as any)?.trial_started_at || null,
          payment_collected: (normalizedData as any)?.payment_collected ?? false,
          requires_subscription: !(normalizedData as any)?.subscribed,
          metadata: (normalizedData as any)?.metadata || null
        };
        
        console.log('[AuthContext] RPC fallback success:', subscriptionResult);
        setSubscriptionData(subscriptionResult);
        setSubscriptionError(null);
        return;
      }
      
      // Both failed - set safe defaults
      console.log('[AuthContext] Both subscription methods failed, using safe defaults');
        setSubscriptionData({
          subscribed: false,
          subscription_tier: 'starter',
          subscription_end: null,
          trial_expires_at: null,
          trial_started_at: null,
          payment_collected: false,
          requires_subscription: true,
          metadata: null
        });
      
    } catch (error: any) {
      console.warn('[AuthContext] Subscription check error:', error);
      // Set safe defaults on error
      if (!subscriptionData) {
        setSubscriptionData({
          subscribed: false,
          subscription_tier: 'starter',
          subscription_end: null,
          trial_expires_at: null,
          trial_started_at: null,
          payment_collected: false,
          requires_subscription: true,
          metadata: null
        });
      }
      setSubscriptionError(error.message || 'Subscription check failed');
    } finally {
      isCheckingRef.current = false;
      setIsChecking(false);
      setSubscriptionLoading(false);
    }
  }, [user, subscriptionData]);

  // Simplified debounced subscription check
  const debouncedCheckSubscription = useCallback(async (delay = 500) => {
    if (subscriptionCheckTimeoutRef.current) {
      clearTimeout(subscriptionCheckTimeoutRef.current);
    }

    // Skip if already checking
    if (isCheckingRef.current) {
      return;
    }

    subscriptionCheckTimeoutRef.current = setTimeout(() => {
      checkSubscriptionStatusWithRetry();
    }, delay);
  }, [checkSubscriptionStatusWithRetry]);

  useEffect(() => {
    mountedRef.current = true;
    
    // Simplified auth initialization
    const initializeAuth = async () => {
      console.log('[AuthContext] Starting auth initialization');
      
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (!mountedRef.current) return;
        
        if (error) {
          console.warn('[AuthContext] getSession error:', error);
          setSession(null);
          setUser(null);
          setOrgData(null);
          setOrgStatus('idle');
          setSubscriptionData(null);
        } else {
          setSession(data.session);
          setUser(data.session?.user ?? null);
          
          if (data.session?.user) {
            console.log('[AuthContext] User authenticated, fetching org data');
            setOrgStatus('loading');
            
            try {
              // Simplified org data fetch with timeout
              const orgPromise = supabase
                .from('users')
                .select('*, organizations (*)')
                .eq('id', data.session.user.id)
                .maybeSingle();
              
              const { data: userData, error: userError } = await Promise.race([
                orgPromise,
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Org fetch timeout')), 8000)
                )
              ]) as any;
              
              if (userError) {
                console.warn('[AuthContext] Org fetch failed, trying RPC:', userError);
                // Simple RPC fallback
                const { data: orgId } = await supabase.rpc('get_current_user_org_id');
                if (orgId) {
                  setOrgData({
                    id: data.session.user.id,
                    org_id: orgId,
                    email: data.session.user.email,
                    organizations: { id: orgId, name: 'Organization' }
                  });
                  setOrgStatus('success');
                } else {
                  setOrgData(null);
                  setOrgStatus('not_found');
                }
              } else if (userData) {
                console.log('[AuthContext] Org data fetched successfully');
                setOrgData(userData);
                setOrgStatus('success');
              } else {
                setOrgData(null);
                setOrgStatus('not_found');
              }
              
              // Start subscription check (but don't wait for it)
              setTimeout(() => {
                if (mountedRef.current) {
                  checkSubscriptionStatusWithRetry().catch(err => 
                    console.warn('[AuthContext] Initial subscription check failed:', err)
                  );
                }
              }, 100);
              
            } catch (error) {
              console.error('[AuthContext] Error in org setup:', error);
              setOrgData(null);
              setOrgStatus('error');
            }
          } else {
            setOrgData(null);
            setOrgStatus('idle');
            setSubscriptionData(null);
          }
        }
      } catch (error) {
        console.error('[AuthContext] Critical initialization error:', error);
        setSession(null);
        setUser(null);
        setOrgData(null);
        setOrgStatus('error');
        setSubscriptionData(null);
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setSubscriptionLoading(false);
          setReady(true);
          console.log('[AuthContext] Auth initialization complete');
        }
      }
    };

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mountedRef.current) return;
        
        console.log('[AuthContext] Auth state change', { event, hasUser: !!session?.user });
        
        setSession(session);
        setUser(session?.user ?? null);
        
        // Only act on true sign-in/out events; ignore periodic TOKEN_REFRESHED
        if (event === 'SIGNED_IN') {
          // Fetch user's org data on sign in
          setTimeout(async () => {
            if (!mountedRef.current) return;
            
            try {
              const { data, error } = await supabase
                .from('users')
                .select(`
                  *,
                  organizations (*)
                `)
                .eq('id', session.user.id)
                .maybeSingle();
              
              if (!mountedRef.current) return;
              
              if (error) {
                console.error('Error fetching org data:', error);
              }
              setOrgData(data);
              
              // Trigger subscription check on sign in
              debouncedCheckSubscription(1000);
            } catch (err) {
              console.error('Error in sign-in handler:', err);
            }
          }, 0);
        } else if (event === 'SIGNED_OUT') {
          // Clear all data on sign out
          setOrgData(null);
          setSubscriptionData(null);
          setSubscriptionLoading(false);
        }
      }
    );

    // Start initialization
    initializeAuth();

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
      if (subscriptionCheckTimeoutRef.current) {
        clearTimeout(subscriptionCheckTimeoutRef.current);
      }
    };
  }, [debouncedCheckSubscription, checkSubscriptionStatusWithRetry]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }, []);

  const value: AuthContextType = {
    user,
    session,
    orgData,
    orgStatus,
    subscriptionData,
    loading,
    subscriptionLoading,
    ready,
    isChecking,
    subscriptionError,
    checkSubscription: debouncedCheckSubscription,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}