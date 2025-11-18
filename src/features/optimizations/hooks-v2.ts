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
 * Generate new recommendations (simplified, synchronous)
 */
export function useGenerateOptimizations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params?: { limit?: number }) => {
      return await api.generateRecommendations(params);
    },
    onSuccess: (data) => {
      console.log('✅ Generation successful:', data);
      queryClient.invalidateQueries({ queryKey: ['optimizations-v2'] });
      queryClient.invalidateQueries({ queryKey: ['low-visibility-prompts'] });
      
      if (data.count > 0) {
        const errorInfo = data.errors?.length ? ` (${data.errors.length} errors)` : '';
        toast({
          title: "Recommendations generated",
          description: `Created ${data.count} new recommendations from ${data.processed} prompts${errorInfo}`,
        });
      } else if (data.message) {
        toast({
          title: "No new recommendations",
          description: data.message,
        });
      }
      // Log errors for debugging
      if (data?.errors?.length) {
        console.warn(`[Optimizations] Errors during generation:`, data.errors);
      }
    },
    onError: (error: Error) => {
      console.error('[useGenerateOptimizations] Error:', error);
      toast({
        title: "Generation failed",
        description: error.message || "Failed to generate recommendations",
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

// Job polling hooks removed - now using synchronous generation