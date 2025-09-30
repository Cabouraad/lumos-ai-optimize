import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  generateForPrompt,
  generateForLowVisibilityBatch,
  enqueueOptimizations, 
  listOptimizationsByPrompt, 
  listOptimizationsByOrg,
  getJob, 
  getLowVisibilityPrompts 
} from './api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export function usePromptOptimizations(promptId: string) {
  return useQuery({ 
    queryKey: ['optimizations', 'prompt', promptId], 
    queryFn: () => listOptimizationsByPrompt(promptId),
    enabled: !!promptId
  });
}

export function useOrgOptimizations() {
  const { orgData } = useAuth();
  
  return useQuery({ 
    queryKey: ['optimizations', 'org', orgData?.organizations?.id], 
    queryFn: () => listOptimizationsByOrg(orgData?.organizations?.id!),
    enabled: !!orgData?.organizations?.id,
    staleTime: 30 * 1000, // Consider data fresh for 30 seconds
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });
}

export function useLowVisibilityPrompts() {
  const { orgData } = useAuth();
  
  return useQuery({
    queryKey: ['low-visibility-prompts', orgData?.organizations?.id],
    queryFn: () => getLowVisibilityPrompts(orgData?.organizations?.id),
    enabled: !!orgData?.organizations?.id,
    staleTime: 30 * 1000, // 30 seconds - now using real-time view
    refetchOnWindowFocus: true, // Refetch when user returns
  });
}

export function useJobStatus(jobId: string | null) {
  return useQuery({
    queryKey: ['optimization-job', jobId],
    queryFn: () => getJob(jobId!),
    enabled: !!jobId,
    refetchInterval: 3000, // Poll every 3 seconds
    refetchIntervalInBackground: false,
  });
}

export function useGenerateForPrompt(promptId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => generateForPrompt(promptId),
    onSuccess: async () => {
      console.log('[useGenerateForPrompt] Generated optimizations for prompt:', promptId);
      toast({
        title: "Success",
        description: "Optimizations generated successfully",
      });
      // Immediately invalidate queries to show new results
      await queryClient.invalidateQueries({ queryKey: ['optimizations', 'prompt', promptId] });
      await queryClient.invalidateQueries({ queryKey: ['optimizations', 'org'] });
      await queryClient.invalidateQueries({ queryKey: ['low-visibility-prompts'] });
    },
    onError: (error) => {
      console.error('[useGenerateForPrompt] Error generating optimizations:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate optimizations",
        variant: "destructive",
      });
    },
  });
}

export function useGenerateForOrg() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (params?: { category?: 'low_visibility' | 'general' }) => {
      console.log('[useGenerateForOrg] Starting generation with category:', params?.category);
      return generateForLowVisibilityBatch(params?.category);
    },
    onSuccess: async (data) => {
      console.log('[useGenerateForOrg] Generated optimizations:', data);
      
      const count = data?.inserted || 0;
      const processed = data?.promptsProcessed || 0;
      
      toast({
        title: "✅ Optimizations Generated",
        description: `Successfully created ${count} new optimizations across ${processed} prompts using latest response data`,
      });
      
      // Invalidate all optimization-related queries to show fresh data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['optimizations'] }),
        queryClient.invalidateQueries({ queryKey: ['low-visibility-prompts'] }),
        queryClient.invalidateQueries({ queryKey: ['prompt-visibility'] }),
      ]);
    },
    onError: (error) => {
      console.error('[useGenerateForOrg] Error generating optimizations:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate optimizations",
        variant: "destructive",
      });
    },
  });
}

// Hook to handle job completion and invalidate queries
export function useJobCompletion(jobId: string | null) {
  const queryClient = useQueryClient();
  const { orgData } = useAuth();
  
  const { data: job } = useJobStatus(jobId);
  
  // Effect to invalidate queries when job is done
  React.useEffect(() => {
    if (job?.status === 'done') {
      console.log('[useJobCompletion] Job completed, invalidating queries');
      
      // Invalidate all optimization queries
      queryClient.invalidateQueries({ queryKey: ['optimizations'] });
      queryClient.invalidateQueries({ queryKey: ['low-visibility-prompts'] });
      
      // Clear the job ID
      queryClient.setQueryData(['latest-job-id'], null);
    }
  }, [job?.status, queryClient]);
  
  return job;
}