import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface LlumosSubmetrics {
  pr: number; // Presence Rate
  pp: number; // Prominence Position
  cv: number; // Coverage Variance
  ca: number; // Citation Authority
  cs: number; // Competitive Share
  fc: number; // Freshness & Consistency
}

export interface LlumosScore {
  id: string;
  org_id: string;
  prompt_id: string | null;
  composite: number;
  llumos_score: number;
  submetrics: LlumosSubmetrics;
  scope: 'org' | 'prompt';
  window_start: string;
  window_end: string;
  reason: string | null;
  created_at: string;
}

export interface LlumosScoreResponse {
  score: number;
  composite: number;
  tier: string;
  submetrics: LlumosSubmetrics;
  window: {
    start: string;
    end: string;
  };
  reason?: string;
  totalResponses?: number;
  cached?: boolean;
}

export function useLlumosScore(promptId?: string) {
  const scope = promptId ? 'prompt' : 'org';
  
  return useQuery({
    queryKey: ['llumos-score', scope, promptId],
    queryFn: async () => {
      // First try to get cached score from database using RPC
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        'compute_llumos_score',
        {
          p_org_id: undefined, // Will be resolved by RLS
          p_prompt_id: promptId || null,
        }
      );

      if (rpcError) {
        console.error('RPC error:', rpcError);
        throw rpcError;
      }

      return rpcResult as unknown as LlumosScoreResponse;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    refetchOnWindowFocus: false,
  });
}

export function useComputeLlumosScore() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ 
      scope, 
      promptId, 
      force = false 
    }: { 
      scope: 'org' | 'prompt'; 
      promptId?: string; 
      force?: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke('compute-llumos-score', {
        body: { scope, promptId, force },
      });
      
      if (error) throw error;
      return data as LlumosScoreResponse;
    },
    onSuccess: (data, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ 
        queryKey: ['llumos-score', variables.scope, variables.promptId] 
      });
      
      toast({
        title: 'Score Updated',
        description: `Your Llumos Score is ${data.score} (${data.tier})`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Computation Failed',
        description: error instanceof Error ? error.message : 'Failed to compute score',
        variant: 'destructive',
      });
    },
  });
}

function getTierFromScore(score: number): string {
  if (score >= 760) return 'Excellent';
  if (score >= 700) return 'Very Good';
  if (score >= 640) return 'Good';
  if (score >= 580) return 'Fair';
  return 'Needs Improvement';
}

export function getScoreColor(score: number): string {
  if (score >= 760) return 'text-emerald-700';
  if (score >= 700) return 'text-green-600';
  if (score >= 640) return 'text-yellow-600';
  if (score >= 580) return 'text-amber-600';
  return 'text-rose-700';
}

export function getScoreBgColor(score: number): string {
  if (score >= 760) return 'bg-emerald-50 border-emerald-200';
  if (score >= 700) return 'bg-green-50 border-green-200';
  if (score >= 640) return 'bg-yellow-50 border-yellow-200';
  if (score >= 580) return 'bg-amber-50 border-amber-200';
  return 'bg-rose-50 border-rose-200';
}
