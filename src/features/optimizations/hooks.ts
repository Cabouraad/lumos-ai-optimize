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
    enabled: !!orgData?.organizations?.id
  });
}

export function useLowVisibilityPrompts() {
  return useQuery({
    queryKey: ['low-visibility-prompts'],
    queryFn: getLowVisibilityPrompts,
    staleTime: 5 * 60 * 1000, // 5 minutes
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
      // Immediately invalidate queries to show new results
      await queryClient.invalidateQueries({ queryKey: ['optimizations', 'prompt', promptId] });
      await queryClient.invalidateQueries({ queryKey: ['optimizations', 'org'] });
      await queryClient.invalidateQueries({ queryKey: ['low-visibility-prompts'] });
    },
  });
}

export function useGenerateForOrg() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (params?: { category?: 'low_visibility' | 'general' }) => 
      generateForLowVisibilityBatch(params?.category),
    onSuccess: async () => {
      console.log('[useGenerateForOrg] Generated optimizations');
      // Immediately invalidate queries to show new results
      await queryClient.invalidateQueries({ queryKey: ['optimizations', 'org'] });
      await queryClient.invalidateQueries({ queryKey: ['low-visibility-prompts'] });
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