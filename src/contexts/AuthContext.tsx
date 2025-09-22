import { useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { EdgeFunctionClient } from '@/lib/edge-functions/client';
import { createSafeContext } from './SafeContexts';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean; // legacy loading for org/subscription fetches
  ready?: boolean;   // initial auth session resolved (authenticated or not)
  subscriptionLoading: boolean;
  orgData: any | null;
  subscriptionData: {
    subscribed: boolean;
    subscription_tier: string | null;
    subscription_end: string | null;
    trial_expires_at?: string;
    trial_started_at?: string;
    payment_collected?: boolean;
    requires_subscription?: boolean;
    metadata?: any; // Include metadata for bypass tracking
  } | null;
  checkSubscription: () => Promise<void>;
  signOut: () => Promise<void>;
}

// Create a default loading state for auth context
const defaultAuthState: AuthContextType = {
  user: null,
  session: null,
  loading: true,
  ready: false,
  subscriptionLoading: true,
  orgData: null,
  subscriptionData: null,
  checkSubscription: async () => {},
  signOut: async () => {}
};

// Create safe context with validation and default loading state
const { Context: AuthContext, Provider: AuthContextProvider, useContext: useAuthContext } = createSafeContext<AuthContextType>('AuthContext', defaultAuthState);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [orgData, setOrgData] = useState<any | null>(null);
  const [subscriptionData, setSubscriptionData] = useState<{
    subscribed: boolean;
    subscription_tier: string | null;
    subscription_end: string | null;
    trial_expires_at?: string;
    trial_started_at?: string;
    payment_collected?: boolean;
    requires_subscription?: boolean;
    metadata?: any; // Include metadata for bypass tracking
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

  const checkSubscriptionStatusWithRetry = useCallback(async () => {
    // Re-fetch session if it appears to be null but we might have missed an update
    let currentSession = session;
    if (!currentSession?.user) {
      const { data: { session: freshSession } } = await supabase.auth.getSession();
      currentSession = freshSession;
      if (!currentSession?.user) {
        devLog('No session available for subscription check');
        return;
      }
    }
    
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second base delay
    
    devLog('Starting subscription check', { email: currentSession.user.email });
    setSubscriptionLoading(true);
    lastSubscriptionCheckRef.current = Date.now();

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const { data, error } = await EdgeFunctionClient.checkSubscription();

        if (error) {
          throw error;
        }

        setSubscriptionData({
          subscribed: data.subscribed,
          subscription_tier: data.subscription_tier,
          subscription_end: data.subscription_end,
          trial_expires_at: data.trial_expires_at,
          trial_started_at: data.trial_started_at,
          payment_collected: data.payment_collected,
          requires_subscription: data.requires_subscription,
          metadata: data.metadata,
        });
        
        devLog('Subscription data updated via edge function', {
          subscribed: data.subscribed,
          subscription_tier: data.subscription_tier,
        });
        
        retryAttemptsRef.current = 0; // Reset retry counter on success
        break;
      } catch (err) {
        if (attempt === maxRetries) {
          // Final attempt - try fallback
          try {
            const { data: rows, error: rpcError } = await supabase.rpc('get_user_subscription_status');
            if (rpcError) throw rpcError;
            
            const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
            if (!row) return; // Keep previous state

            const trialValid = !!row.trial_expires_at && new Date(row.trial_expires_at) > new Date();
            const requires_subscription = !(row.subscribed || trialValid);

            setSubscriptionData({
              subscribed: !!row.subscribed,
              subscription_tier: row.subscription_tier ?? null,
              subscription_end: row.subscription_end ?? null,
              trial_expires_at: row.trial_expires_at ?? undefined,
              trial_started_at: undefined,
              payment_collected: row.payment_collected ?? undefined,
              requires_subscription,
              metadata: undefined,
            });
            
            devLog('Subscription data updated via fallback RPC');
            break;
          } catch (fallbackErr) {
            console.error('All subscription check attempts failed:', fallbackErr);
            // Keep previous state instead of nullifying
          }
        } else {
          // Wait before retry with exponential backoff
          const delay = baseDelay * Math.pow(2, attempt);
          devLog(`Subscription check attempt ${attempt + 1} failed, retrying in ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    setSubscriptionLoading(false);
  }, [session, devLog]);

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
              
              if (userError) {
                console.error('Error fetching org data:', userError);
                devLog('Org data fetch failed, continuing without org data');
                setOrgData(null);
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
        
        // Update local state only; do NOT navigate on TOKEN_REFRESHED
        setSession(session);
        setUser(session?.user ?? null);
        
        // Only act on true sign-in/out events; ignore periodic TOKEN_REFRESHED
        switch (event) {
          case 'SIGNED_IN':
            // Optional: redirect logic here if needed
            break;
          case 'SIGNED_OUT':
            // Optional: redirect logic here if needed  
            break;
          default:
            // TOKEN_REFRESHED, USER_UPDATED, etc. => no navigation
            break;
        }
        
        if (session?.user) {
          // Fetch user's org data on auth change
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
              
              // Only check subscription on initial sign-in, not on every token refresh
              if (event === 'SIGNED_IN') {
                await debouncedCheckSubscription(100); // Quick initial check
              } else if (event === 'TOKEN_REFRESHED') {
                await debouncedCheckSubscription(2000); // Slower refresh check
              }
              
              setLoading(false);
            } catch (err) {
              if (!mountedRef.current) return;
              console.error('Exception in org data fetch:', err);
              setOrgData(null);
              setLoading(false);
            }
          }, 0);
        } else {
          setOrgData(null);
          setSubscriptionData(null);
          setSubscriptionLoading(false);
          setLoading(false);
        }
      }
    );

    // Initialize auth state
    initializeAuth();

    // Emergency fallback: If auth hasn't resolved after 15 seconds, force ready=true
    const emergencyTimeout = setTimeout(() => {
      if (mountedRef.current && !ready) {
        console.warn('Auth initialization timeout - forcing ready=true to prevent infinite loading');
        devLog('Emergency timeout triggered - forcing ready=true');
        setReady(true);
        setLoading(false);
        setSubscriptionLoading(false);
      }
    }, 15000);

     return () => {
       mountedRef.current = false;
       subscription.unsubscribe();
       clearTimeout(emergencyTimeout);
       if (subscriptionCheckTimeoutRef.current) {
         clearTimeout(subscriptionCheckTimeoutRef.current);
       }
     };
   }, []); // Empty dependency array to prevent re-running

  const checkSubscription = useCallback(async () => {
    // Call directly to avoid debouncing races for manual checks
    await checkSubscriptionStatusWithRetry();
  }, [checkSubscriptionStatusWithRetry]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContextProvider value={{ user, session, loading, ready, subscriptionLoading, orgData, subscriptionData, checkSubscription, signOut }}>
      {children}
    </AuthContextProvider>
  );
}

// Export the safe hook
export const useAuth = useAuthContext;