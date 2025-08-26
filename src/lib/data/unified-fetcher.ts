/**
 * Simplified: Unified data fetcher using standard caching approach
 */
import { supabase } from "@/integrations/supabase/client";
import { getOrgId } from "@/lib/auth";

export interface UnifiedDashboardData {
  // Metrics
  avgScore: number;
  overallScore: number; 
  trend: number;
  promptCount: number;
  totalRuns: number;
  recentRunsCount: number;
  
  // Chart data
  chartData: Array<{
    date: string;
    score: number;
    runs: number;
  }>;
  
  // System info
  providers: Array<{
    id: string;
    name: string;
    enabled: boolean;
  }>;
  
  // Prompt summaries
  prompts: Array<{
    id: string;
    text: string;
    active: boolean;
    created_at: string;
    latestScore: number;
    hasData: boolean;
    org_id: string;
  }>;
}

export interface UnifiedPromptData extends UnifiedDashboardData {
  // Detailed prompt data with provider breakdowns
  promptDetails: Array<{
    promptId: string;
    promptText: string;
    active: boolean;
    providers: {
      openai: ProviderResponseData | null;
      gemini: ProviderResponseData | null;
      perplexity: ProviderResponseData | null;
    };
    overallScore: number;
    lastRunAt: string | null;
    sevenDayStats: {
      totalRuns: number;
      avgScore: number;
      brandPresenceRate: number;
    };
    competitors: Array<{
      name: string;
      count: number;
    }>;
  }>;
}

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
  error: string | null;
  token_in: number;
  token_out: number;
}

/**
 * Simplified: Unified data fetcher for dashboard data
 */
export async function getUnifiedDashboardData(useCache = true): Promise<UnifiedDashboardData> {
  try {
    const orgId = await getOrgId();

    // Single query to get all prompt data
    const [promptsResult, providersResult] = await Promise.all([
      supabase
        .from("prompts")
        .select("id, text, active, created_at, org_id")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false }),
      supabase
        .from("llm_providers")
        .select("id, name, enabled")
    ]);

    if (promptsResult.error) throw promptsResult.error;
    if (providersResult.error) throw providersResult.error;

    const prompts = promptsResult.data || [];
    const providers = providersResult.data || [];
    const promptIds = prompts.map(p => p.id);

    if (promptIds.length === 0) {
      return {
        avgScore: 0,
        overallScore: 0,
        trend: 0,
        promptCount: 0,
        totalRuns: 0,
        recentRunsCount: 0,
        chartData: [],
        providers,
        prompts: []
      };
    }

    // Get all responses for the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const { data: responses, error: responsesError } = await supabase
      .from('prompt_provider_responses')
      .select('prompt_id, run_at, score, status')
      .in('prompt_id', promptIds)
      .eq('status', 'success')
      .gte('run_at', thirtyDaysAgo.toISOString())
      .order('run_at', { ascending: true });

    if (responsesError) throw responsesError;

    const validResponses = responses || [];

    // Calculate metrics
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    // Today's scores for avgScore
    const todayScores = validResponses
      .filter(r => r.run_at.startsWith(today))
      .map(r => r.score);

    const avgScore = todayScores.length > 0 
      ? todayScores.reduce((sum, s) => sum + s, 0) / todayScores.length 
      : 0;

    // Last 7 days for overallScore
    const last7DaysResponses = validResponses.filter(r => new Date(r.run_at) >= sevenDaysAgo);
    const last7DaysScores = last7DaysResponses.map(r => r.score);
    
    const overallScore = last7DaysScores.length > 0
      ? last7DaysScores.reduce((sum, s) => sum + s, 0) / last7DaysScores.length
      : 0;

    // Previous 7 days for trend calculation
    const prev7DaysScores = validResponses
      .filter(r => {
        const date = new Date(r.run_at);
        return date >= fourteenDaysAgo && date < sevenDaysAgo;
      })
      .map(r => r.score);

    const prevAvg = prev7DaysScores.length > 0
      ? prev7DaysScores.reduce((sum, s) => sum + s, 0) / prev7DaysScores.length
      : 0;

    const trend = prevAvg > 0 ? ((overallScore - prevAvg) / prevAvg) * 100 : 0;

    // Chart data - group by day
    const dailyScores = new Map<string, number[]>();
    validResponses.forEach(response => {
      const date = response.run_at.split('T')[0];
      if (!dailyScores.has(date)) {
        dailyScores.set(date, []);
      }
      dailyScores.get(date)!.push(response.score);
    });

    const chartData = Array.from(dailyScores.entries())
      .map(([date, scores]) => ({
        date,
        score: Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 10) / 10,
        runs: scores.length
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Prompt summaries with latest scores
    const promptSummaries = prompts.map(prompt => {
      const promptResponses = validResponses.filter(r => r.prompt_id === prompt.id);
      const latestScore = promptResponses.length > 0 
        ? promptResponses[promptResponses.length - 1].score 
        : 0;
      
      return {
        id: prompt.id,
        text: prompt.text,
        active: prompt.active,
        created_at: prompt.created_at,
        latestScore: Math.round(latestScore * 10) / 10,
        hasData: promptResponses.length > 0,
        org_id: prompt.org_id
      };
    });

    return {
      avgScore: Math.round(avgScore * 10) / 10,
      overallScore: Math.round(overallScore * 10) / 10,
      trend: Math.round(trend * 10) / 10,
      promptCount: prompts.length,
      totalRuns: validResponses.length,
      recentRunsCount: last7DaysResponses.length,
      chartData,
      providers,
      prompts: promptSummaries
    };

  } catch (error) {
    console.error("Dashboard data error:", error);
    throw error;
  }
}

/**
 * Simplified: Unified prompt data fetcher
 */
export async function getUnifiedPromptData(useCache = true): Promise<UnifiedPromptData> {
  try {
    const orgId = await getOrgId();

    // Get base dashboard data
    const dashboardData = await getUnifiedDashboardData(useCache);
    const safePrompts = Array.isArray((dashboardData as any)?.prompts) ? (dashboardData as any).prompts : [];
    
    if (safePrompts.length === 0) {
      return {
        ...dashboardData,
        prompts: [],
        promptDetails: []
      };
    }

    const promptIds = safePrompts.map(p => p.id);
    
    if (promptIds.length === 0) {
      return {
        ...dashboardData,
        prompts: [],
        promptDetails: []
      };
    }

    // Get latest provider responses and simplified data in parallel
    const [latestResponsesResult, sevenDayResult] = await Promise.all([
      supabase
        .from('latest_prompt_provider_responses')
        .select('*')
        .in('prompt_id', promptIds),
        
      supabase
        .rpc('get_prompt_visibility_7d', { requesting_org_id: orgId })
    ]);

    const latestResponses = latestResponsesResult.data || [];
    const sevenDayData = sevenDayResult.data || [];

    // Process detailed prompt data
    const promptDetails = safePrompts.map(prompt => {
      // Group latest responses by provider
      const promptResponses = latestResponses.filter(r => r.prompt_id === prompt.id);
      const providerData = {
        openai: promptResponses.find(r => r.provider === 'openai') as ProviderResponseData || null,
        gemini: promptResponses.find(r => r.provider === 'gemini') as ProviderResponseData || null,
        perplexity: promptResponses.find(r => r.provider === 'perplexity') as ProviderResponseData || null,
      };

      // Calculate overall score
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

      // Simplified competitor data
      const promptCompetitors: Array<{ name: string; count: number }> = [];

      // Get 7-day stats
      const promptSevenDay = sevenDayData.find((s: any) => s.prompt_id === prompt.id);
      const sevenDayStats = {
        totalRuns: Number(promptSevenDay?.runs_7d || 0),
        avgScore: Number(promptSevenDay?.avg_score_7d || 0),
        brandPresenceRate: 0,
      };

      return {
        promptId: prompt.id,
        promptText: prompt.text,
        active: prompt.active,
        providers: providerData,
        overallScore: Math.round(overallScore * 10) / 10,
        lastRunAt,
        sevenDayStats,
        competitors: promptCompetitors
      };
    });

    return {
      ...dashboardData,
      promptDetails
    };

  } catch (error) {
    console.error("Prompt data error:", error);
    throw error;
  }
}

/**
 * Simplified cache invalidation
 */
export function invalidateCache(keys?: string[]): void {
  // With React Query, this would typically be handled by query invalidation
  console.log('Cache invalidation requested for:', keys);
}

/**
 * Get individual prompt provider history (for expanded rows)
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
 * Simplified refresh function
 */
export function refreshAfterBrandFix() {
  // This would trigger React Query refetch in practice
  console.log('Refreshing data after brand fix');
}