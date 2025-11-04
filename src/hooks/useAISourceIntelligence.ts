import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AISource {
  domain: string;
  total_citations: number;
  model_count: number;
  last_cited: string;
  models: string[];
}

export function useAISourceIntelligence(orgId: string | undefined, limit?: number) {
  return useQuery({
    queryKey: ['ai-source-intelligence', orgId, limit],
    queryFn: async (): Promise<AISource[]> => {
      if (!orgId) throw new Error('Organization ID required');

      const { data, error } = await supabase
        .from('ai_sources_top_domains')
        .select('*')
        .eq('org_id', orgId)
        .order('total_citations', { ascending: false })
        .limit(limit || 50);

      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
