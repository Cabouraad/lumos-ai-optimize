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
      // NEW: Use queue-based processing to avoid CORS/CSP issues
      const { enqueueOptimizationJob, pollJobStatus } = await import('@/features/optimizations/api');
      
      // Step 1: Enqueue the job
      const { jobId } = await enqueueOptimizationJob(promptId);
      
      toast.info('Job queued', { 
        description: 'Processing optimizations in background...' 
      });

      // Step 2: Poll for completion (every 2 seconds, up to 2 minutes)
      const maxPolls = 60; // 2 minutes
      const pollInterval = 2000; // 2 seconds

      for (let i = 0; i < maxPolls; i++) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
        const status = await pollJobStatus(jobId);
        
        if (status.status === 'done') {
          return { success: true, jobId };
        } else if (status.status === 'failed') {
          throw new Error(status.error_text || 'Job failed');
        }
        // Continue polling if status is 'queued' or 'running'
      }

      // Timeout after 2 minutes
      toast.info('Still processing', {
        description: 'Job is taking longer than expected. Check back in a few minutes.'
      });
      return { success: false, timeout: true, jobId };
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
        toast.success("Optimizations generated successfully");
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
