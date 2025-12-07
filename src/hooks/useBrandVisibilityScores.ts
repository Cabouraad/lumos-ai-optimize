import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface BrandVisibilityScore {
  brandId: string;
  score: number;
  totalPrompts: number;
  brandPresenceRate: number;
  lastActivity: string | null;
  totalMentions: number;
}

interface BrandCardStatsRow {
  brand_id: string;
  prompt_count: number;
  brand_presence_rate: number;
  visibility_score: number;
  total_responses: number;
}

/**
 * Fetch visibility scores for multiple brands using efficient batched query
 */
export function useBrandVisibilityScores(brandIds: string[]) {
  return useQuery({
    queryKey: ['brand-visibility-scores', brandIds],
    queryFn: async () => {
      if (brandIds.length === 0) {
        return [];
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (userError || !userData?.org_id) {
        throw new Error('No organization found');
      }

      // Use the lightweight batched function instead of calling heavy RPC per brand
      const { data, error } = await supabase.rpc('get_brand_card_stats', {
        p_org_id: userData.org_id,
        p_brand_ids: brandIds
      });

      if (error) {
        console.error('Error fetching brand card stats:', error);
        // Return empty scores for all brands on error
        return brandIds.map(brandId => ({
          brandId,
          score: 0,
          totalPrompts: 0,
          brandPresenceRate: 0,
          totalMentions: 0,
          lastActivity: null
        }));
      }

      // Map the results to the expected format
      const statsMap = new Map<string, BrandCardStatsRow>();
      if (Array.isArray(data)) {
        (data as BrandCardStatsRow[]).forEach(row => {
          statsMap.set(row.brand_id, row);
        });
      }

      // Return scores for all requested brand IDs
      const scores: BrandVisibilityScore[] = brandIds.map(brandId => {
        const stats = statsMap.get(brandId);
        if (stats) {
          return {
            brandId,
            score: stats.visibility_score || 0,
            totalPrompts: stats.prompt_count || 0,
            brandPresenceRate: stats.brand_presence_rate || 0,
            totalMentions: stats.total_responses || 0,
            lastActivity: null // Not needed for cards
          };
        }
        return {
          brandId,
          score: 0,
          totalPrompts: 0,
          brandPresenceRate: 0,
          totalMentions: 0,
          lastActivity: null
        };
      });

      return scores;
    },
    enabled: brandIds.length > 0,
    staleTime: 60000, // Cache for 1 minute
    refetchOnWindowFocus: false
  });
}
