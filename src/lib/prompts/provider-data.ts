import { supabase } from "@/integrations/supabase/client";
import { getOrgId } from "@/lib/auth";

export interface ProviderResponseData {
  id: string;
  provider: string;
  model: string | null;
  status: string;
  run_at: string;
  score: number;
  org_brand_present: boolean;
  org_brand_prominence: number | null;
  competitors_count: number;
  brands_json: string[];
  competitors_json: string[];
  raw_ai_response: string | null;
  raw_evidence: string | null;
  error: string | null;
  token_in: number;
  token_out: number;
  metadata: any;
}

export interface PromptProviderSummary {
  promptId: string;
  promptText: string;
  providers: {
    openai: ProviderResponseData | null;
    gemini: ProviderResponseData | null;
    perplexity: ProviderResponseData | null;
  };
  overallScore: number;
  lastRunAt: string | null;
  competitorList: Array<{
    name: string;
    mentionCount: number;
    providers: string[];
  }>;
  sevenDayStats: {
    totalRuns: number;
    avgScore: number;
    brandPresenceRate: number;
  };
}

/**
 * Get detailed provider-specific data for all prompts
 */
export async function getPromptsWithProviderData(): Promise<PromptProviderSummary[]> {
  try {
    const orgId = await getOrgId();

    // Get all prompts for the org
    const { data: prompts, error: promptsError } = await supabase
      .from('prompts')
      .select('id, text, active, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (promptsError) throw promptsError;
    if (!prompts || prompts.length === 0) return [];

    const promptIds = prompts.map(p => p.id);

    // Get latest responses per provider per prompt
    const { data: latestResponses, error: responsesError } = await supabase
      .from('latest_prompt_provider_responses')
      .select('*')
      .in('prompt_id', promptIds);

    if (responsesError) throw responsesError;

    // Get 7-day stats using RPC
    const { data: sevenDayData, error: sevenDayError } = await supabase
      .rpc('get_prompt_visibility_7d', { requesting_org_id: orgId });

    if (sevenDayError) console.warn('Error fetching 7-day stats:', sevenDayError);

    // Get competitor mentions aggregated
    const { data: competitorData, error: competitorError } = await supabase
      .from('competitor_mentions')
      .select('prompt_id, competitor_name, mention_count')
      .in('prompt_id', promptIds)
      .order('mention_count', { ascending: false });

    if (competitorError) console.warn('Error fetching competitors:', competitorError);

    // Process data for each prompt
    return prompts.map(prompt => {
      // Group latest responses by provider
      const promptResponses = (latestResponses || []).filter(r => r.prompt_id === prompt.id);
      const providerData: PromptProviderSummary['providers'] = {
        openai: promptResponses.find(r => r.provider === 'openai') as ProviderResponseData || null,
        gemini: promptResponses.find(r => r.provider === 'gemini') as ProviderResponseData || null,
        perplexity: promptResponses.find(r => r.provider === 'perplexity') as ProviderResponseData || null,
      };

      // Calculate overall score from available providers
      const scores = Object.values(providerData)
        .filter(p => p && p.status === 'success')
        .map(p => p!.score);
      const overallScore = scores.length > 0 
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length 
        : 0;

      // Get latest run time
      const lastRunAt = Object.values(providerData)
        .filter(p => p?.run_at)
        .map(p => p!.run_at)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null;

      // Process competitors for this prompt
      const promptCompetitors = (competitorData || [])
        .filter(c => c.prompt_id === prompt.id)
        .reduce((acc, curr) => {
          const existing = acc.find(c => c.name === curr.competitor_name);
          if (existing) {
            existing.mentionCount += curr.mention_count;
          } else {
            acc.push({
              name: curr.competitor_name,
              mentionCount: curr.mention_count,
              providers: [], // TODO: Track which providers mentioned this competitor
            });
          }
          return acc;
        }, [] as Array<{ name: string; mentionCount: number; providers: string[] }>);

      // Get 7-day stats for this prompt
      const promptSevenDay = (sevenDayData || []).find(s => s.prompt_id === prompt.id);
      const sevenDayStats = {
        totalRuns: Number(promptSevenDay?.runs_7d || 0),
        avgScore: Number(promptSevenDay?.avg_score_7d || 0),
        brandPresenceRate: 0, // TODO: Calculate from recent responses
      };

      return {
        promptId: prompt.id,
        promptText: prompt.text,
        providers: providerData,
        overallScore: Math.round(overallScore * 10) / 10,
        lastRunAt,
        competitorList: promptCompetitors.slice(0, 10), // Top 10 competitors
        sevenDayStats,
      };
    });

  } catch (error) {
    console.error("Error fetching prompt provider data:", error);
    throw error;
  }
}

/**
 * Get detailed response history for a specific prompt and provider
 */
export async function getPromptProviderHistory(
  promptId: string, 
  provider: string, 
  limit: number = 10
): Promise<ProviderResponseData[]> {
  try {
    const { data, error } = await supabase
      .from('prompt_provider_responses')
      .select('*')
      .eq('prompt_id', promptId)
      .eq('provider', provider)
      .order('run_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data as ProviderResponseData[]) || [];
  } catch (error) {
    console.error(`Error fetching ${provider} history for prompt ${promptId}:`, error);
    throw error;
  }
}

/**
 * Get aggregated competitor data across all prompts for the org
 */
export async function getOrgCompetitorSummary(): Promise<Array<{
  name: string;
  totalMentions: number;
  promptCount: number;
  avgPosition: number;
  recentMentions: number;
}>> {
  try {
    const orgId = await getOrgId();

    const { data, error } = await supabase
      .from('competitor_mentions')
      .select(`
        competitor_name,
        mention_count,
        average_position,
        last_seen_at,
        prompt_id
      `)
      .eq('org_id', orgId)
      .order('mention_count', { ascending: false });

    if (error) throw error;

    // Aggregate by competitor name
    const competitorMap = new Map();
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    (data || []).forEach(mention => {
      const name = mention.competitor_name;
      if (!competitorMap.has(name)) {
        competitorMap.set(name, {
          name,
          totalMentions: 0,
          promptCount: 0,
          positions: [],
          recentMentions: 0,
          promptIds: new Set(),
        });
      }

      const competitor = competitorMap.get(name);
      competitor.totalMentions += mention.mention_count;
      competitor.promptIds.add(mention.prompt_id);
      
      if (mention.average_position) {
        competitor.positions.push(mention.average_position);
      }

      if (new Date(mention.last_seen_at) >= oneWeekAgo) {
        competitor.recentMentions += mention.mention_count;
      }
    });

    // Convert to final format
    return Array.from(competitorMap.values()).map(comp => ({
      name: comp.name,
      totalMentions: comp.totalMentions,
      promptCount: comp.promptIds.size,
      avgPosition: comp.positions.length > 0 
        ? comp.positions.reduce((sum: number, pos: number) => sum + pos, 0) / comp.positions.length 
        : 0,
      recentMentions: comp.recentMentions,
    })).sort((a, b) => b.totalMentions - a.totalMentions);

  } catch (error) {
    console.error("Error fetching competitor summary:", error);
    throw error;
  }
}