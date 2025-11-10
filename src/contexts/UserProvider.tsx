import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthProvider';

interface UserData {
  id: string;
  email: string;
  role: string;
  org_id: string | null;
  tour_completions?: Record<string, boolean>;
  organizations: {
    id: string;
    name: string;
    domain: string;
    plan_tier: string;
  } | null;
}

interface UserContextType {
  userData: UserData | null;
  loading: boolean;
  error: string | null;
  ready: boolean;
  refreshUserData: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  userData: null,
  loading: false,
  error: null,
  ready: false,
  refreshUserData: async () => {},
});

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within UserProvider');
  }
  return context;
};

interface UserProviderProps {
  children: React.ReactNode;
}

export function UserProvider({ children }: UserProviderProps) {
  const { user, ready } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true); // Start as true to prevent race condition
  const [error, setError] = useState<string | null>(null);
  const [userReady, setUserReady] = useState(false);

  const fetchUserData = useCallback(async () => {
    if (!user) {
      setUserData(null);
      setError(null);
      setLoading(false);
      setUserReady(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('[UserProvider] Fetching user data for:', user.email);
      
      // First ensure user record exists
      const { error: ensureError } = await supabase.functions.invoke('ensure-user-record');
      
      if (ensureError) {
        console.warn('[UserProvider] Ensure user record failed:', ensureError);
        // Continue anyway - not critical
      }

      // Fetch user data with organization
      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          email,
          role,
          org_id,
          tour_completions,
          organizations (
            id,
            name,
            domain,
            plan_tier
          )
        `)
        .eq('id', user.id)
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error('User not found in database');
      }

      // Allow users without org_id - they will be redirected to onboarding
      setUserData(data as UserData);
      setError(null);
    } catch (err) {
      console.error('[UserProvider] Error fetching user data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load user data');
      setUserData(null);
    } finally {
      setLoading(false);
      setUserReady(true);
    }
  }, [user?.id]); // Only depend on user ID, not entire user object

  useEffect(() => {
    if (ready) {
      fetchUserData();
    }
  }, [ready, fetchUserData]);

  const value: UserContextType = {
    userData,
    loading,
    error,
    ready: userReady,
    refreshUserData: fetchUserData,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}