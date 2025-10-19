import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { clearOrgIdCache } from '@/lib/org-id';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  ready: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  ready: false,
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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // Get initial session with server-side validation
    const initializeAuth = async () => {
      try {
        // First check localStorage
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        // If we have a session, validate it with the server
        if (session) {
          const { data: { user }, error } = await supabase.auth.getUser();
          
          if (error || !user) {
            console.warn('[AuthProvider] Session invalid, clearing:', error?.message);
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
          } else {
            setSession(session);
            setUser(user);
          }
        } else {
          setSession(null);
          setUser(null);
        }
      } catch (error) {
        console.error('[AuthProvider] Error getting initial session:', error);
        // Clear potentially invalid session
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
      } finally {
        if (isMounted) {
          setLoading(false);
          setReady(true);
        }
      }
    };

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;
        
        console.log('[AuthProvider] Auth state change:', event, !!session);
        
        // Clear org ID cache on sign out to prevent cross-user data leakage
        if (event === 'SIGNED_OUT') {
          clearOrgIdCache();
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        
        // Update ready state
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

  const signOut = useCallback(async () => {
    try {
      // Clear org ID cache before signing out
      clearOrgIdCache();
      await supabase.auth.signOut();
    } catch (error) {
      console.error('[AuthProvider] Error signing out:', error);
    }
  }, []);

  const value: AuthContextType = {
    user,
    session,
    loading,
    ready,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}