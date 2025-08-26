import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

interface OrgContextType {
  orgData: any | null;
  loading: boolean;
}

const OrgContext = createContext<OrgContextType | undefined>(undefined);

export function OrgProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [orgData, setOrgData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      // Fetch user's org data
      const fetchOrgData = async () => {
        try {
          const { data, error } = await supabase
            .from('users')
            .select(`
              *,
              organizations (*)
            `)
            .eq('id', user.id)
            .maybeSingle();
          
          if (error) {
            console.error('Error fetching org data:', error);
            setOrgData(null);
          } else {
            setOrgData(data);
          }
        } catch (err) {
          console.error('Exception in org data fetch:', err);
          setOrgData(null);
        } finally {
          setLoading(false);
        }
      };

      fetchOrgData();
    } else {
      setOrgData(null);
      setLoading(false);
    }
  }, [user]);

  return (
    <OrgContext.Provider value={{ orgData, loading }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const context = useContext(OrgContext);
  if (context === undefined) {
    throw new Error('useOrg must be used within an OrgProvider');
  }
  return context;
}