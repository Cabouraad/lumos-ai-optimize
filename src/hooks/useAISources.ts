import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AISource {
  domain: string;
  total_citations: number;
  model_count: number;
  last_cited: string;
  models: string[];
}

export function useTopAISources(orgId: string | undefined, limit: number = 5) {
  return useQuery({
    queryKey: ['ai-sources-top', orgId, limit],
    queryFn: async (): Promise<AISource[]> => {
      if (!orgId) throw new Error('Organization ID required');

      const { data, error } = await supabase
        .from('ai_sources_top_domains')
        .select('*')
        .eq('org_id', orgId)
        .limit(limit);

      if (error) throw error;

      return data || [];
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useAllAISources(orgId: string | undefined) {
  return useQuery({
    queryKey: ['ai-sources-all', orgId],
    queryFn: async (): Promise<AISource[]> => {
      if (!orgId) throw new Error('Organization ID required');

      const { data, error } = await supabase
        .from('ai_sources_top_domains')
        .select('*')
        .eq('org_id', orgId);

      if (error) throw error;

      return data || [];
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });
}
