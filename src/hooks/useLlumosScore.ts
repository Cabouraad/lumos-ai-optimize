import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getOrgIdSafe } from '@/lib/org-id';
import { useEffect } from 'react';

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
  const queryClient = useQueryClient();

  // Resolve org id to avoid cross-org cache pollution
  const { data: orgId } = useQuery({
    queryKey: ['org-id'],
    queryFn: getOrgIdSafe,
    staleTime: 5 * 60 * 1000,
  });

  // Subscribe to realtime updates for llumos_scores
  useEffect(() => {
    if (!orgId) return;

    const channel = supabase
      .channel('llumos-score-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'llumos_scores',
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => {
          console.log('[Llumos Score] Realtime update received:', payload);
          
          // Check if this update matches our current query
          const newData = payload.new as any;
          if (newData && 
              newData.scope === scope && 
              (promptId ? newData.prompt_id === promptId : !newData.prompt_id)) {
            // Invalidate the specific query to trigger a refetch
            queryClient.invalidateQueries({ 
              queryKey: ['llumos-score', orgId, scope, promptId ?? null] 
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, scope, promptId, queryClient]);
  
  return useQuery({
    queryKey: ['llumos-score', orgId ?? 'unknown-org', scope, promptId ?? null],
    enabled: !!orgId,
    queryFn: async () => {
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
    staleTime: 60 * 1000, // 1 minute (reduced from 1 hour)
    refetchOnWindowFocus: true, // Re-check when user returns to tab
    refetchOnReconnect: true, // Re-check on network reconnection
    refetchOnMount: 'always', // Always check on mount
    refetchInterval: 60 * 1000, // Poll every 60 seconds when tab is active
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
    onSuccess: () => {
      // Invalidate all Llumos score queries (keys include orgId internally)
      queryClient.invalidateQueries({ queryKey: ['llumos-score'] });
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
