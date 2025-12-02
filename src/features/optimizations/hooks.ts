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
      const errors = result?.errors || [];
      
      if (count > 0) {
        toast.success(`Generated ${count} optimization${count !== 1 ? 's' : ''}!`);
        queryClient.invalidateQueries({ queryKey: ['prompt-optimizations'] });
      } else if (errors.length > 0) {
        // Show specific error to user
        const errorMsg = errors[0];
        if (errorMsg.includes('timed out')) {
          toast.error('Generation timed out', {
            description: 'The AI took too long to respond. Please try again with a shorter prompt or try again later.',
            duration: 6000,
          });
        } else if (errorMsg.includes('429')) {
          toast.error('Rate limit exceeded', {
            description: 'Too many requests. Please wait a moment and try again.',
            duration: 6000,
          });
        } else if (errorMsg.includes('402')) {
          toast.error('Payment required', {
            description: 'Please add credits to your Lovable AI workspace to continue.',
            duration: 6000,
          });
        } else {
          toast.error('Generation failed', {
            description: errorMsg.length > 100 ? errorMsg.substring(0, 100) + '...' : errorMsg,
            duration: 6000,
          });
        }
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
