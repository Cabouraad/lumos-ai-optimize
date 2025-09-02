import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  orgData: any | null;
  subscriptionData: {
    subscribed: boolean;
    subscription_tier: string | null;
    subscription_end: string | null;
    trial_expires_at?: string;
    trial_started_at?: string;
    payment_collected?: boolean;
    requires_subscription?: boolean;
  } | null;
  checkSubscription: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgData, setOrgData] = useState<any | null>(null);
  const [subscriptionData, setSubscriptionData] = useState<{
    subscribed: boolean;
    subscription_tier: string | null;
    subscription_end: string | null;
    trial_expires_at?: string;
    trial_started_at?: string;
    payment_collected?: boolean;
    requires_subscription?: boolean;
  } | null>(null);

  useEffect(() => {
    let subscriptionCheckTimeout: NodeJS.Timeout;

    // Debounced subscription check for app load
    const debouncedSubscriptionCheck = () => {
      if (subscriptionCheckTimeout) {
        clearTimeout(subscriptionCheckTimeout);
      }
      subscriptionCheckTimeout = setTimeout(() => {
        checkSubscriptionStatus();
      }, 1000); // 1 second debounce
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
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
              
               // Check subscription status on auth state changes
               if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                 await checkSubscriptionStatus();
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
           setLoading(false);
         }
      }
    );

    // Check for existing session and trigger debounced check
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        setLoading(false);
      } else {
        // Debounced check for app load with existing session
        debouncedSubscriptionCheck();
      }
    });

    return () => {
      subscription.unsubscribe();
      if (subscriptionCheckTimeout) {
        clearTimeout(subscriptionCheckTimeout);
      }
    };
  }, []);

  const checkSubscriptionStatus = async () => {
    try {
      // Always pass an explicit Authorization header to avoid limbo tokens
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      if (error) {
        console.error('Error checking subscription (edge function):', error);
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
      });
    } catch (err) {
      console.error('Exception checking subscription via edge function, falling back to DB RPC:', err);
      // Fallback to DB (does not require Stripe; uses current subscribers record)
      try {
        const { data: rows, error: rpcError } = await supabase.rpc('get_user_subscription_status');
        if (rpcError) {
          console.error('RPC get_user_subscription_status error:', rpcError);
          return;
        }
        const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
        if (!row) return;

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
        });
      } catch (fallbackErr) {
        console.error('Fallback RPC subscription check failed:', fallbackErr);
      }
    }
  };

  const checkSubscription = async () => {
    await checkSubscriptionStatus();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, orgData, subscriptionData, checkSubscription, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}