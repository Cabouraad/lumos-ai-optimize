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
    mutationFn: () => generateVisibilityRecommendations(promptId),
    onError: (error: any) => {
      console.error('Generation error:', error);
      toast.error(`Failed to generate recommendations: ${error?.message || error}`);
    },
    onSuccess: async (result) => {
      toast.success(`Created ${result.inserted} recommendation(s)`);
      await queryClient.invalidateQueries({ queryKey: ['visibility-recs', promptId] });
      await queryClient.invalidateQueries({ queryKey: ['visibility-recs', 'all'] });
      await queryClient.invalidateQueries({ queryKey: ['low-visibility-prompts'] });
    },
  });
}
