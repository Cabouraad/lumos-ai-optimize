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
  } | null>(null);

  useEffect(() => {
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
              
              // Check subscription status
              await checkSubscriptionStatus();
              
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

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkSubscriptionStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (error) {
        console.error('Error checking subscription:', error);
        return;
      }
      setSubscriptionData({
        subscribed: data.subscribed,
        subscription_tier: data.subscription_tier,
        subscription_end: data.subscription_end,
        trial_expires_at: data.trial_expires_at,
        trial_started_at: data.trial_started_at,
        payment_collected: data.payment_collected,
      });
    } catch (err) {
      console.error('Exception checking subscription:', err);
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