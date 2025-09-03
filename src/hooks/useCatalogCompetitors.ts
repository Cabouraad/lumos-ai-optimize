import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getOrgId } from '@/lib/auth';

interface CatalogCompetitor {
  id: string;
  name: string;
  is_org_brand: boolean;
  total_appearances: number;
  last_seen_at: string;
}

export function useCatalogCompetitors() {
  const [competitors, setCompetitors] = useState<CatalogCompetitor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCatalogCompetitors();
  }, []);

  const fetchCatalogCompetitors = async () => {
    try {
      setLoading(true);
      const orgId = await getOrgId();

      const { data, error } = await supabase
        .from('brand_catalog')
        .select('id, name, is_org_brand, total_appearances, last_seen_at')
        .eq('org_id', orgId)
        .eq('is_org_brand', false)
        .order('total_appearances', { ascending: false });

      if (error) {
        console.error('Error fetching catalog competitors:', error);
        return;
      }

      setCompetitors(data || []);
    } catch (error) {
      console.error('Error in fetchCatalogCompetitors:', error);
    } finally {
      setLoading(false);
    }
  };

  const isCompetitorInCatalog = useCallback((competitorName: string): boolean => {
    return competitors.some(c => 
      c.name.toLowerCase().trim() === competitorName.toLowerCase().trim()
    );
  }, [competitors]);

  const filterCompetitorsByCatalog = useCallback((competitorList: string[]): string[] => {
    return competitorList.filter(competitor => isCompetitorInCatalog(competitor));
  }, [isCompetitorInCatalog]);

  return {
    competitors,
    loading,
    isCompetitorInCatalog,
    filterCompetitorsByCatalog,
    refetch: fetchCatalogCompetitors
  };
}