import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ClusterPromptsParams {
  promptIds?: string[];
  orgId: string;
}

export function useClusterPrompts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ promptIds, orgId }: ClusterPromptsParams) => {
      const { data, error } = await supabase.functions.invoke('cluster-prompts', {
        body: { promptIds, orgId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      toast({
        title: 'Prompts clustered successfully',
        description: `Organized into ${data.tags?.length || 0} categories`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Clustering failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
