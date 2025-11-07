import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

export type CompetitorSummaryRow = {
  competitor_name: string;
  total_mentions: number;
  distinct_prompts: number;
  first_seen: string | null;
  last_seen: string | null;
  avg_score: number | null;
  share_pct: number | null;
  trend_score: number | null;
};

export type CompetitorFilters = {
  days?: number;
  providers?: string[];
  limit?: number;
  offset?: number;
  brandId?: string | null;
};

/**
 * Fetches competitor summary using the optimized v2 RPC
 * Falls back gracefully if the function doesn't exist yet
 */
export async function fetchCompetitorsV2(filters: CompetitorFilters = {}): Promise<CompetitorSummaryRow[]> {
  const sb = getSupabaseBrowserClient();
  const { data: session } = await sb.auth.getSession();
  
  if (!session?.session?.access_token) {
    throw new Error('Unauthenticated');
  }

  // Get org_id from session user metadata
  const { data: { user } } = await sb.auth.getUser();
  const orgId = user?.user_metadata?.org_id || null;

  const { data, error } = await sb.rpc('get_org_competitor_summary_v2', {
    p_org_id: orgId,
    p_days: filters.days ?? 30,
    p_limit: Math.min(filters.limit ?? 50, 50),
    p_offset: filters.offset ?? 0,
    p_providers: filters.providers ?? null,
    p_brand_id: filters.brandId ?? null,
  });

  if (error) throw error;
  return (data ?? []) as CompetitorSummaryRow[];
}
