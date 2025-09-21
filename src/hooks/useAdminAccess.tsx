import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export function useAdminAccess() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkAdminAccess() {
      // Wait for auth to finish loading before checking admin access
      if (authLoading) {
        return;
      }

      if (!user) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      try {
        const { data: userData, error } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error checking admin access:', error);
          setIsAdmin(false);
        } else {
          // Check if user has admin or owner role
          setIsAdmin(userData?.role && ['owner', 'admin'].includes(userData.role));
        }
      } catch (error) {
        console.error('Error checking admin access:', error);
        setIsAdmin(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkAdminAccess();
  }, [user, authLoading]);

  return { isAdmin, isLoading };
}