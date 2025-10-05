/**
 * Optimizations V2 React Hooks
 * Clean, performant hooks using TanStack Query
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { invokeEdge } from '@/lib/supabase/invoke';
import * as api from './api-v2';

/**
 * Fetch all optimizations
 */
export function useOptimizations(params?: {
  category?: string;
  status?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['optimizations-v2', params],
    queryFn: () => api.listOptimizations(params),
  });
}

/**
 * Fetch single optimization
 */
export function useOptimization(id: string) {
  return useQuery({
    queryKey: ['optimization-v2', id],
    queryFn: () => api.getOptimization(id),
    enabled: !!id,
  });
}

/**
 * Fetch low visibility prompts
 */
export function useLowVisibilityPrompts(limit?: number) {
  return useQuery({
    queryKey: ['low-visibility-prompts', limit],
    queryFn: () => api.getLowVisibilityPrompts(limit),
  });
}

/**
 * Generate new optimizations
 */
export function useGenerateOptimizations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params?: { promptIds?: string[] }) => {
      console.log('[useGenerateOptimizations] Starting generation with params:', params);
      
      const { data, error } = await invokeEdge('generate-optimizations-v2', {
        body: {
          scope: params?.promptIds ? 'batch' : 'organization',
          promptIds: params?.promptIds,
        }
      });

      console.log('[useGenerateOptimizations] Response:', { data, error });

      if (error) {
        console.error('[useGenerateOptimizations] Error:', error);
        throw new Error(error.message || 'Failed to start generation');
      }
      
      if (!data?.success) {
        throw new Error(data?.error || 'Generation failed');
      }

      return data;
    },
    onSuccess: (data) => {
      console.log('[useGenerateOptimizations] Success:', data);
      queryClient.invalidateQueries({ queryKey: ['optimizations-v2'] });
      queryClient.invalidateQueries({ queryKey: ['generation-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['low-visibility-prompts'] });
      
      toast({
        title: "Optimization generation started",
        description: `Job ${data.jobId} is processing in background.`,
      });
    },
    onError: (error: Error) => {
      console.error('[useGenerateOptimizations] Mutation error:', error);
      toast({
        title: "Failed to generate optimizations",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

/**
 * Update optimization status
 */
export function useUpdateOptimizationStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'open' | 'in_progress' | 'completed' | 'dismissed' }) =>
      api.updateOptimizationStatus(id, status),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['optimizations-v2'] });
      queryClient.invalidateQueries({ queryKey: ['optimization-v2', data.id] });
      
      toast({
        title: "Status updated",
        description: `Optimization marked as ${data.status}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

/**
 * Poll job status
 */
export function useGenerationJob(jobId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['generation-job', jobId],
    queryFn: () => api.getGenerationJob(jobId!),
    enabled: !!jobId && (options?.enabled !== false),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // Poll every 2 seconds while running, stop when complete
      return status === 'running' || status === 'queued' ? 2000 : false;
    },
  });
}

/**
 * Get recent generation jobs
 */
export function useRecentGenerationJobs(limit?: number) {
  return useQuery({
    queryKey: ['generation-jobs', 'recent', limit],
    queryFn: () => api.getRecentJobs(limit),
  });
}