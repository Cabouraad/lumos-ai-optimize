import { useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { EdgeFunctionClient } from '@/lib/edge-functions/client';
import { createSafeContext, withContextRetry } from './SafeContexts';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
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

// Create safe context with validation
const { Context: AuthContext, Provider: AuthContextProvider, useContext: useAuthContext } = createSafeContext<AuthContextType>('AuthContext');

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
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
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        devLog('Auth state change', { event, hasUser: !!session?.user });
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fetch user's org data
          setTimeout(async () => {
            try {
              const { data, error } = await supabase
                .from('users')
                .select(`
                  *,
                  organizations (*)
                `)
                .eq('id', session.user.id)
                .maybeSingle();
              
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

     // Check for existing session and trigger initial subscription check
     supabase.auth.getSession().then(({ data: { session } }) => {
       setSession(session);
       setUser(session?.user ?? null);
       if (!session) {
         setLoading(false);
        } else {
          // Initial subscription check with force flag to ensure it runs
          debouncedCheckSubscription(1000, true);
        }
     });

     return () => {
       subscription.unsubscribe();
       if (subscriptionCheckTimeoutRef.current) {
         clearTimeout(subscriptionCheckTimeoutRef.current);
       }
     };
   }, [debouncedCheckSubscription, devLog]);

  const checkSubscription = useCallback(async () => {
    // Call directly to avoid debouncing races for manual checks
    await checkSubscriptionStatusWithRetry();
  }, [checkSubscriptionStatusWithRetry]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContextProvider value={{ user, session, loading, subscriptionLoading, orgData, subscriptionData, checkSubscription, signOut }}>
      {children}
    </AuthContextProvider>
  );
}

// Export the safe hook with retry logic
export const useAuth = withContextRetry(useAuthContext, 'AuthContext');