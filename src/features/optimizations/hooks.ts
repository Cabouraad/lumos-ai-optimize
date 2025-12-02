/**
 * Optimizations hooks for v2 system
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { OptimizationV2 } from './api-v2';

/**
 * Generate recommendations for a specific prompt
 */
export function useGeneratePromptOptimizations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (promptId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Authentication required');
      }

      console.log('🎯 [useGeneratePromptOptimizations] Generating for prompt:', promptId);

      const { data, error } = await supabase.functions.invoke('generate-recommendations', {
        body: { promptId, limit: 1 },
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('🎯 [useGeneratePromptOptimizations] Error:', error);
        throw new Error(error.message || 'Failed to generate optimizations');
      }

      console.log('🎯 [useGeneratePromptOptimizations] Response:', data);
      return data;
    },
    onSuccess: (result) => {
      const count = result?.count || 0;
      if (count > 0) {
        toast.success(`Generated ${count} optimization${count !== 1 ? 's' : ''}!`);
        queryClient.invalidateQueries({ queryKey: ['prompt-optimizations'] });
      } else {
        toast.info('No new optimizations generated', {
          description: result?.message || 'This prompt may already have optimizations or sufficient visibility.'
        });
      }
    },
    onError: (error: Error) => {
      toast.error('Failed to generate optimizations', { description: error.message });
    },
  });
}

/**
 * List optimizations for a specific prompt
 */
export function usePromptOptimizations(promptId: string | null) {
  return useQuery({
    queryKey: ['prompt-optimizations', promptId],
    queryFn: async () => {
      if (!promptId) return [];
      
      const { data, error } = await supabase
        .from('optimizations_v2')
        .select('*')
        .eq('prompt_id', promptId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as OptimizationV2[];
    },
    enabled: !!promptId,
    staleTime: 60_000,
  });
}
