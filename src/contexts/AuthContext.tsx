import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { EdgeFunctionClient } from '@/lib/edge-functions/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  orgData: any | null;
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
  checkSubscription: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  orgData: null,
  subscriptionData: null,
  loading: true,
  subscriptionLoading: false,
  ready: false,
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

  // Debouncing and error recovery state
  const mountedRef = useRef(true);
  const subscriptionCheckTimeoutRef = useRef<NodeJS.Timeout>();
  const retryAttemptsRef = useRef(0);
  const lastSubscriptionCheckRef = useRef<number>(0);

  // Development-only logging helper
  const devLog = useCallback((message: string, data?: any) => {
    if (import.meta.env.DEV) {
      console.log(`[AuthContext] ${message}`, data || '');
    }
  }, []);

  const checkSubscriptionStatusWithRetry = useCallback(async (maxAttempts = 4) => {
    if (!user || !user.email) {
      devLog('No user available for subscription check');
      return;
    }

    // Validate session before making requests
    if (!session?.access_token) {
      devLog('[AUTH_CONTEXT_SUBSCRIPTION_CHECK] No valid session token, refreshing session first');
      try {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshData.session) {
          devLog('[AUTH_CONTEXT_SUBSCRIPTION_CHECK] Session refresh failed', refreshError);
          setSubscriptionLoading(false);
          return;
        }
        devLog('[AUTH_CONTEXT_SUBSCRIPTION_CHECK] Session refreshed successfully');
      } catch (refreshException) {
        devLog('[AUTH_CONTEXT_SUBSCRIPTION_CHECK] Session refresh exception', refreshException);
        setSubscriptionLoading(false);
        return;
      }
    }
    
    devLog('[AUTH_CONTEXT_SUBSCRIPTION_CHECK] Starting subscription check', {
      email: user.email,
      userId: user.id,
      sessionValid: !!session,
      hasAccessToken: !!session?.access_token
    });

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      devLog(`[AUTH_CONTEXT_SUBSCRIPTION_CHECK] Attempt ${attempt}/${maxAttempts}`);
      
      try {
        // Add timeout to prevent hanging requests
        const checkPromise = supabase.functions.invoke('check-subscription');
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 15000)
        );
        
        const { data, error } = await Promise.race([checkPromise, timeoutPromise]) as any;
        
        if (error) {
          lastError = new Error(`Edge function error (${error.message || 'unknown'})`);
          devLog(`[AUTH_CONTEXT_SUBSCRIPTION_CHECK] Attempt ${attempt} failed:`, error);
          
          // For authentication errors, try session refresh
          if (error.message?.includes('401') || error.message?.includes('Authentication failed')) {
            devLog('[AUTH_CONTEXT_SUBSCRIPTION_CHECK] Authentication error detected, refreshing session');
            try {
              await supabase.auth.refreshSession();
              devLog('[AUTH_CONTEXT_SUBSCRIPTION_CHECK] Session refreshed after auth error');
            } catch (refreshErr) {
              devLog('[AUTH_CONTEXT_SUBSCRIPTION_CHECK] Session refresh failed after auth error', refreshErr);
            }
          }
          
          if (attempt < maxAttempts) {
            // Wait before retry with exponential backoff
            const delay = Math.min(2000 * Math.pow(1.5, attempt - 1), 8000);
            devLog(`[AUTH_CONTEXT_SUBSCRIPTION_CHECK] Waiting ${delay}ms before retry`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        } else {
          devLog('[AUTH_CONTEXT_SUBSCRIPTION_CHECK] Success:', {
            subscribed: data?.subscribed,
            tier: data?.subscription_tier,
            requires_subscription: data?.requires_subscription
          });
          
          setSubscriptionData(data);
          setSubscriptionLoading(false);
          devLog('[AUTH_CONTEXT_SUBSCRIPTION_CHECK] Subscription loading set to false');
          return;
        }
      } catch (networkError: any) {
        lastError = networkError;
        devLog(`[AUTH_CONTEXT_SUBSCRIPTION_CHECK] Network error on attempt ${attempt}:`, networkError);
        
        if (attempt < maxAttempts) {
          const delay = Math.min(2000 * Math.pow(1.5, attempt - 1), 8000);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
    }
    
    // All attempts failed - fall back to RPC with timeout
    devLog('[AUTH_CONTEXT_SUBSCRIPTION_CHECK] All edge function attempts failed, trying RPC fallback');
    console.warn('Edge function check-subscription failed after retries, attempting RPC fallback:', lastError);
    
    try {
      const rpcPromise = supabase.rpc('get_user_subscription_status');
      const rpcTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('RPC timeout')), 10000)
      );
      
      const { data: rpcData, error: rpcError } = await Promise.race([rpcPromise, rpcTimeout]) as any;
      
      if (rpcError) {
        console.error('RPC fallback also failed:', rpcError);
        devLog('[AUTH_CONTEXT_SUBSCRIPTION_CHECK] RPC fallback failed');
        throw rpcError;
      }
      
      devLog('[AUTH_CONTEXT_SUBSCRIPTION_CHECK] RPC fallback successful');
      setSubscriptionData(rpcData);
    } catch (rpcFinalError) {
      console.error('Both edge function and RPC failed:', rpcFinalError);
      devLog('[AUTH_CONTEXT_SUBSCRIPTION_CHECK] Both methods failed, setting defaults');
      
      // Set safe defaults when both methods fail
      setSubscriptionData({
        subscribed: false,
        subscription_tier: null,
        subscription_end: null,
        trial_expires_at: null,
        trial_started_at: null,
        payment_collected: false,
        requires_subscription: true
      });
    } finally {
      setSubscriptionLoading(false);
      devLog('[AUTH_CONTEXT_SUBSCRIPTION_CHECK] Final subscription loading set to false');
    }
  }, [user, session, devLog, supabase]);

  // Debounced subscription check with error recovery
  const debouncedCheckSubscription = useCallback(async (delay = 500, force = false) => {
    // Clear any pending subscription check
    if (subscriptionCheckTimeoutRef.current) {
      clearTimeout(subscriptionCheckTimeoutRef.current);
    }

    // Skip if we checked recently (within 30 seconds), unless forced or subscriptionData is null
    const now = Date.now();
    if (!force && subscriptionData !== null && now - lastSubscriptionCheckRef.current < 30000) {
      devLog('Skipping subscription check - too recent');
      return;
    }

    subscriptionCheckTimeoutRef.current = setTimeout(async () => {
      await checkSubscriptionStatusWithRetry();
    }, delay);
  }, [checkSubscriptionStatusWithRetry, subscriptionData, devLog]);

  useEffect(() => {
    mountedRef.current = true;
    
    // Initialize auth state - ALWAYS resolve ready, even on error
    const initializeAuth = async () => {
      devLog('Starting auth initialization');
      
      try {
        devLog('Attempting to get session');
        const { data, error } = await supabase.auth.getSession();
        
        if (!mountedRef.current) {
          devLog('Component unmounted during getSession');
          return;
        }
        
        if (error) {
          console.warn('getSession error:', error);
          devLog('getSession failed, treating as unauthenticated', error);
          setSession(null);
          setUser(null);
          setOrgData(null);
          setSubscriptionData(null);
          setLoading(false);
          setSubscriptionLoading(false);
        } else {
          devLog('getSession successful', { hasUser: !!data.session?.user });
          setSession(data.session);
          setUser(data.session?.user ?? null);
          
          if (data.session?.user) {
            // Fetch user's org data with timeout and fallback
            try {
              devLog('Fetching user org data');
              
              // Add a timeout to prevent hanging on network issues
              const orgDataPromise = supabase
                .from('users')
                .select(`
                  *,
                  organizations (*)
                `)
                .eq('id', data.session.user.id)
                .maybeSingle();
              
              const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Org data fetch timeout')), 10000)
              );
              
              const { data: userData, error: userError } = await Promise.race([
                orgDataPromise,
                timeoutPromise
              ]) as any;
              
              devLog('Org data fetch result:', {
                userId: data.session.user.id,
                userEmail: data.session.user.email,
                error: userError,
                userData: userData,
                hasOrganizations: userData?.organizations ? 'yes' : 'no',
                orgId: userData?.organizations?.id,
                orgName: userData?.organizations?.name
              });
              
              if (userError) {
                console.error('Error fetching org data:', userError);
                devLog('Org data fetch failed, trying fallback RPC');
                
                // Try fallback RPC call
                try {
                  const { data: fallbackOrgId, error: rpcError } = await supabase.rpc('get_current_user_org_id');
                  
                  devLog('Fallback RPC result:', {
                    fallbackOrgId,
                    rpcError
                  });
                  
                  if (rpcError) {
                    console.error('Fallback RPC also failed:', rpcError);
                    setOrgData(null);
                  } else if (fallbackOrgId) {
                    // Create minimal org data structure
                    const fallbackOrgData = {
                      id: data.session.user.id,
                      org_id: fallbackOrgId,
                      email: data.session.user.email,
                      organizations: {
                        id: fallbackOrgId,
                        name: 'Organization' // Placeholder name
                      }
                    };
                    devLog('Using fallback org data:', fallbackOrgData);
                    setOrgData(fallbackOrgData);
                  } else {
                    devLog('No fallback org data available');
                    setOrgData(null);
                  }
                } catch (rpcException) {
                  console.error('Exception in fallback RPC:', rpcException);
                  setOrgData(null);
                }
              } else {
                devLog('Org data fetched successfully');
                setOrgData(userData);
              }
              
              // Initial subscription check with timeout - call directly to decouple from debounced version
              try {
                devLog('Starting direct subscription check for initialization');
                await Promise.race([
                  checkSubscriptionStatusWithRetry(),
                  new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Subscription check timeout')), 15000)
                  )
                ]);
              } catch (subError) {
                console.warn('Subscription check failed:', subError);
                devLog('Subscription check failed, continuing without subscription data');
              }
              
              setLoading(false);
            } catch (err) {
              console.error('Exception in org data fetch:', err);
              devLog('Exception in user data setup, continuing gracefully');
              setOrgData(null);
              setLoading(false);
            }
          } else {
            devLog('No user session, setting defaults');
            setOrgData(null);
            setSubscriptionData(null);
            setSubscriptionLoading(false);
            setLoading(false);
          }
        }
      } catch (err) {
        console.warn('Auth initialization error:', err);
        devLog('Critical auth initialization error, failing gracefully', err);
        
        if (!mountedRef.current) return;
        
        // Set safe defaults for all state
        setSession(null);
        setUser(null);
        setOrgData(null);
        setSubscriptionData(null);
        setLoading(false);
        setSubscriptionLoading(false);
      } finally {
        // CRITICAL: Always set ready to true, even on error
        if (mountedRef.current) {
          devLog('Setting ready=true after auth initialization');
          setReady(true);
          devLog('Auth initialization complete - ready flag set', { ready: true });
        }
      }
    };

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mountedRef.current) return;
        
        devLog('Auth state change', { event, hasUser: !!session?.user });
        
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
              debouncedCheckSubscription(1000, true);
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
  }, [debouncedCheckSubscription, checkSubscriptionStatusWithRetry, devLog]);

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
    subscriptionData,
    loading,
    subscriptionLoading,
    ready,
    checkSubscription: checkSubscriptionStatusWithRetry,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}