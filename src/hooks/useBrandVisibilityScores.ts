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

/**
 * Fetch visibility scores for multiple brands
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

      // Fetch visibility scores for each brand
      const scores: BrandVisibilityScore[] = await Promise.all(
        brandIds.map(async (brandId) => {
          try {
            const { data, error } = await supabase.rpc('get_unified_dashboard_data', {
              p_org_id: userData.org_id,
              p_brand_id: brandId
            });

            if (error) {
              console.error(`Error fetching score for brand ${brandId}:`, error);
              return { 
                brandId, 
                score: 0,
                totalPrompts: 0,
                brandPresenceRate: 0,
                totalMentions: 0,
                lastActivity: null
              };
            }

            // Type assertion for the RPC response
            const result = data as any;
            const avgScore = result?.metrics?.avgScore || 0;
            const totalPrompts = result?.metrics?.totalPrompts || 0;
            const brandPresenceRate = result?.metrics?.brandPresenceRate || 0;
            const totalMentions = result?.metrics?.totalMentions || 0;
            const lastActivity = result?.metrics?.lastActivity || null;
            
            return { 
              brandId, 
              score: avgScore,
              totalPrompts,
              brandPresenceRate,
              totalMentions,
              lastActivity
            };
          } catch (error) {
            console.error(`Error fetching score for brand ${brandId}:`, error);
            return { 
              brandId, 
              score: 0,
              totalPrompts: 0,
              brandPresenceRate: 0,
              totalMentions: 0,
              lastActivity: null
            };
          }
        })
      );

      return scores;
    },
    enabled: brandIds.length > 0,
    staleTime: 60000, // Cache for 1 minute
    refetchOnWindowFocus: false
  });
}
