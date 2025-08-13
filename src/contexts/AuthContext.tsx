import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  orgData: any | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgData, setOrgData] = useState<any | null>(null);

  useEffect(() => {
    console.log('AuthProvider: Setting up auth state listener');
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('AuthProvider: Auth state changed', { event, hasSession: !!session, userId: session?.user?.id });
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          console.log('AuthProvider: User found, fetching org data for:', session.user.id);
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
              
              console.log('AuthProvider: Org data query result', { data, error });
              
              if (error) {
                console.error('AuthProvider: Error fetching org data:', error);
              }
              
              setOrgData(data);
              setLoading(false);
            } catch (err) {
              console.error('AuthProvider: Exception in org data fetch:', err);
              setOrgData(null);
              setLoading(false);
            }
          }, 0);
        } else {
          console.log('AuthProvider: No user, clearing org data');
          setOrgData(null);
          setLoading(false);
        }
      }
    );

    // Check for existing session
    console.log('AuthProvider: Checking for existing session');
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('AuthProvider: Initial session check', { hasSession: !!session, userId: session?.user?.id, error });
      
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        console.log('AuthProvider: No initial session, stopping loading');
        setLoading(false);
      }
    });

    return () => {
      console.log('AuthProvider: Cleaning up auth subscription');
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, orgData, signOut }}>
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