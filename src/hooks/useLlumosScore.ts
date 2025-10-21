import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
      // Call the edge function to compute/fetch score
      const { data, error } = await supabase.functions.invoke('compute-llumos-score', {
        body: { 
          scope,
          promptId,
          force: false // Use cached if available
        },
      });

      if (error) {
        console.error('Llumos score error:', error);
        throw error;
      }

      return data as LlumosScoreResponse;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    refetchOnWindowFocus: false,
  });
}

export function useComputeLlumosScore() {
  const queryClient = useQueryClient();
  
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
      // Invalidate relevant queries to refresh in background
      queryClient.invalidateQueries({ 
        queryKey: ['llumos-score', variables.scope, variables.promptId] 
      });
    },
    onError: (error) => {
      // Silent failure - log for debugging only
      console.error('[Llumos Score] Computation failed:', error);
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
