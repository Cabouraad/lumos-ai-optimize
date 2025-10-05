import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { generateVisibilityRecommendations, listVisibilityRecommendations, listAllOrgRecommendations } from './api';
import { toast } from 'sonner';

export function useVisibilityRecommendations(promptId: string) {
  return useQuery({
    queryKey: ['visibility-recs', promptId],
    queryFn: () => listVisibilityRecommendations(promptId),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useAllVisibilityRecommendations() {
  return useQuery({
    queryKey: ['visibility-recs', 'all'],
    queryFn: () => listAllOrgRecommendations(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useGenerateVisibilityRecs(promptId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationKey: ['generate-visibility-recs', promptId],
    mutationFn: async () => {
      const res = await generateVisibilityRecommendations(promptId);
      if (res.error) {
        throw new Error(res.detail || res.error);
      }
      return res;
    },
    onSuccess: async (res) => {
      // Refresh relevant views
      await queryClient.invalidateQueries({ queryKey: ['visibility-recs', promptId] });
      await queryClient.invalidateQueries({ queryKey: ['visibility-recs', 'all'] });
      await queryClient.invalidateQueries({ queryKey: ['low-visibility-prompts'] });
      await queryClient.invalidateQueries({ queryKey: ['optimizations'] });

      toast.success('Recommendations generated', {
        description: res.message || "We've added fresh optimizations for this prompt."
      });
    },
    onError: (err: any) => {
      toast.error('Could not generate recommendations', {
        description: String(err?.message || err)
      });
    }
  });
}
