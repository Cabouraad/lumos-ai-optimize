import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { getOrgIdSafe } from '@/lib/org-id';

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

  // Resolve org_id reliably
  const orgId = await getOrgIdSafe();

  // Always default to 30 days for rolling history
  const { data, error } = await sb.rpc('get_org_competitor_summary_v2_secure', {
    p_days: filters.days ?? 30,
    p_limit: Math.min(filters.limit ?? 50, 50),
    p_offset: filters.offset ?? 0,
    p_providers: filters.providers ?? null,
    p_brand_id: filters.brandId ?? null,
  });

  if (error) {
    console.warn('[competitors_v2] RPC failed, falling back to brand_catalog:', error.message);
  }

  let rows = (data ?? []) as CompetitorSummaryRow[];

  // Fallback: if RPC returns empty, derive top competitors from brand_catalog
  if (!rows || rows.length === 0) {
    const { data: bc, error: bcError } = await sb
      .from('brand_catalog')
      .select('name,total_appearances,first_detected_at,last_seen_at,average_score')
      .eq('is_org_brand', false)
      .order('total_appearances', { ascending: false })
      .limit(Math.min(filters.limit ?? 5, 50));

    if (bcError) throw bcError;

    rows = (bc ?? []).map((b: any) => ({
      competitor_name: b.name,
      total_mentions: Number(b.total_appearances ?? 0),
      distinct_prompts: 0,
      first_seen: b.first_detected_at ?? null,
      last_seen: b.last_seen_at ?? null,
      avg_score: b.average_score ?? null,
      share_pct: null,
      trend_score: null,
    }));
  }

  return rows;
}
