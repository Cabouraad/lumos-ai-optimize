import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfDay } from 'date-fns';

interface CitationTrendData {
  date: string;
  citations: number;
}

interface CitationTrendsResult {
  trends: CitationTrendData[];
  totalCitations: number;
  percentageChange: number;
  isGrowing: boolean;
}

export function useCitationTrends(orgId: string | undefined, days: number = 30, brandId?: string | null) {
  return useQuery({
    queryKey: ['citation-trends', orgId, days, brandId ?? null],
    queryFn: async (): Promise<CitationTrendsResult> => {
      if (!orgId) {
        return {
          trends: [],
          totalCitations: 0,
          percentageChange: 0,
          isGrowing: false,
        };
      }

      const startDate = startOfDay(subDays(new Date(), days));
      
      // Get citation data - join with prompts to filter by brand
      let query = supabase
        .from('prompt_provider_responses')
        .select('run_at, citations_json, prompts!inner(brand_id)')
        .eq('org_id', orgId)
        .gte('run_at', startDate.toISOString())
        .not('citations_json', 'is', null);
      
      // Filter by brand via prompts table if brandId provided
      if (brandId) {
        query = query.eq('prompts.brand_id', brandId);
      }
      
      const { data: responses, error } = await query;

      if (error) throw error;

      // Group citations by date
      const citationsByDate = new Map<string, number>();
      
      responses?.forEach((response) => {
        const date = format(new Date(response.run_at), 'yyyy-MM-dd');
        
        // Handle the nested citations_json structure
        let citations = 0;
        if (response.citations_json && typeof response.citations_json === 'object') {
          const citationsData = response.citations_json as any;
          if (Array.isArray(citationsData.citations)) {
            citations = citationsData.citations.length;
          } else if (Array.isArray(citationsData)) {
            citations = citationsData.length;
          }
        }
        
        citationsByDate.set(
          date,
          (citationsByDate.get(date) || 0) + citations
        );
      });

      // Fill in missing dates with 0
      const trends: CitationTrendData[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
        trends.push({
          date,
          citations: citationsByDate.get(date) || 0,
        });
      }

      const totalCitations = trends.reduce((sum, t) => sum + t.citations, 0);
      
      // Calculate percentage change (comparing first half vs second half of period)
      const halfwayPoint = Math.floor(trends.length / 2);
      const firstHalf = trends.slice(0, halfwayPoint);
      const secondHalf = trends.slice(halfwayPoint);
      
      const firstHalfTotal = firstHalf.reduce((sum, t) => sum + t.citations, 0);
      const secondHalfTotal = secondHalf.reduce((sum, t) => sum + t.citations, 0);
      
      const percentageChange = firstHalfTotal > 0 
        ? ((secondHalfTotal - firstHalfTotal) / firstHalfTotal) * 100 
        : secondHalfTotal > 0 ? 100 : 0;

      return {
        trends,
        totalCitations,
        percentageChange: Math.round(percentageChange),
        isGrowing: percentageChange > 0,
      };
    },
    enabled: !!orgId,
  });
}
