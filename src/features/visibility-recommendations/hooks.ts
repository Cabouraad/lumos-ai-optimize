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

"use client";

export function useGenerateVisibilityRecs(promptId?: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationKey: ['generate-visibility-recs', promptId],
    mutationFn: async () => {
      // Use the new simplified V2 API
      const { generateRecommendations } = await import('@/features/optimizations/api-v2');
      
      // Generate recommendations synchronously
      const result = await generateRecommendations({
        limit: 10
      });
      
      if (result.count > 0) {
        toast.success('Recommendations generated', { 
          description: `Created ${result.count} recommendations` 
        });
      }

      return { success: true, ...result };
    },
    onSuccess: async (data) => {
      if (data.success) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['optimizations'] }),
          promptId ? queryClient.invalidateQueries({ queryKey: ['optimizations', promptId] }) : Promise.resolve(),
          queryClient.invalidateQueries({ queryKey: ['visibility_prompts'] }),
          queryClient.invalidateQueries({ queryKey: ['visibility-recs', promptId] }),
          queryClient.invalidateQueries({ queryKey: ['visibility-recs', 'all'] }),
          queryClient.invalidateQueries({ queryKey: ['low-visibility-prompts'] }),
        ]);
      }
    },
    onError: (err: any) => {
      const status = err?.status ?? "n/a";
      const detail =
        err?.response?.detail || err?.response?.error || err?.message || String(err);
      toast.error("Generation Failed", {
        description: `Status ${status}: ${detail}`,
      });
    }
  });
}
