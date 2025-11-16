/**
 * Phase 2 Enhanced: Unified data fetcher with advanced caching and ML integration
 */
import { supabase } from "@/integrations/supabase/client";
import { getOrgId } from "@/lib/auth";
import { advancedCache, CacheEventManager } from "../advanced-cache/redis-cache";
import { backgroundPreloader } from "../background-optimization/data-preloader";
import { isOptimizationFeatureEnabled, withFeatureFlag } from "@/config/featureFlags";
import { getBulkPromptData, groupResponsesByPrompt, groupStatsByPrompt } from "./bulk-fetcher";
import { processUnifiedData } from "./dashboard-helpers";
import { responseCache } from "../cache/response-cache";

// Initialize Phase 2 cache event management
const cacheEventManager = CacheEventManager.getInstance();

const CACHE_TTL = {
  dashboard: 2 * 60 * 1000, // 2 minutes
  prompts: 1 * 60 * 1000,   // 1 minute
  providers: 5 * 60 * 1000,  // 5 minutes
};

// Type guards to validate cached data shapes
function isValidDashboardData(data: any): data is UnifiedDashboardData {
  return data && 
    typeof data === 'object' &&
    typeof data.avgScore === 'number' &&
    typeof data.overallScore === 'number' &&
    typeof data.promptCount === 'number' &&
    Array.isArray(data.chartData) &&
    Array.isArray(data.providers) &&
    Array.isArray(data.prompts);
}

function isValidPromptData(data: any): data is UnifiedPromptData {
  return data && 
    typeof data === 'object' &&
    typeof data.avgScore === 'number' &&
    typeof data.overallScore === 'number' &&
    typeof data.promptCount === 'number' &&
    Array.isArray(data.chartData) &&
    Array.isArray(data.providers) &&
    Array.isArray(data.prompts) &&
    Array.isArray(data.promptDetails);
}

// Legacy cache functions for backward compatibility
async function getCachedData<T>(key: string): Promise<T | null> {
  // Try advanced cache first, fallback to legacy
  const cached = await advancedCache.get<T>(key);
  return cached ? cached : null;
}

function setCachedData(key: string, data: any, ttl: number): void {
  advancedCache.set(key, data, ttl);
}

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
    runs7d: number;
    avgScore7d: number;
    brandVisibleCount: number;
    competitorCount: number;
    brandPresenceRate: number;
    latestResponses?: { [provider: string]: ProviderResponseData };
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
      google_ai_overview: ProviderResponseData | null;
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
  metadata?: { reason?: string; [key: string]: any };
  citations_json?: any;
}

/**
 * Phase 2 Enhanced: Unified data fetcher with background preloading and date filtering
 */
export async function getUnifiedDashboardData(
  useCache = true, 
  dateFrom?: Date, 
  dateTo?: Date
): Promise<UnifiedDashboardData> {
  try {
    const orgId = await getOrgId();
    const dateKey = dateFrom && dateTo ? `-${dateFrom.toISOString()}-${dateTo.toISOString()}` : '';
    const cacheKey = `dashboard-data-${orgId}${dateKey}`;
    
    if (useCache && !dateFrom && !dateTo) {
      const cached = await advancedCache.get<UnifiedDashboardData>(cacheKey);
      if (cached && isValidDashboardData(cached)) {
        return cached;
      }
    }

    // Trigger Phase 2 background preloading for future requests
    backgroundPreloader.preloadCriticalData();

    // Use bulk queries when feature flag enabled
    const result = await withFeatureFlag(
      'FEATURE_BULK_QUERIES',
      () => getUnifiedDashboardDataBulk(orgId, dateFrom, dateTo),
      () => getUnifiedDashboardDataStandard(orgId, dateFrom, dateTo),
      'getUnifiedDashboardData'
    );

    // Phase 2: Use advanced cache with event-driven invalidation
    if (!dateFrom && !dateTo) {
      advancedCache.set(cacheKey, result, CACHE_TTL.dashboard);
    }
    return result;

  } catch (error) {
    console.error("Unified dashboard data error:", error);
    throw error;
  }
}

/**
 * Optimized bulk data fetching (FEATURE_BULK_QUERIES enabled)
 */
async function getUnifiedDashboardDataBulk(
  orgId: string, 
  dateFrom?: Date, 
  dateTo?: Date
): Promise<UnifiedDashboardData> {
  // Single bulk fetch instead of multiple queries
  const bulkData = await getBulkPromptData();
  const { prompts, latestResponses, sevenDayStats } = bulkData;

  if (prompts.length === 0) {
    return {
      avgScore: 0,
      overallScore: 0,
      trend: 0,
      promptCount: 0,
      totalRuns: 0,
      recentRunsCount: 0,
      chartData: [],
      providers: [], // await getProviders(), // Temporarily disabled
      prompts: []
    };
  }

  // Pre-group data for O(1) lookups instead of O(n²) filtering
  const responsesByPrompt = groupResponsesByPrompt(latestResponses);
  const statsByPrompt = groupStatsByPrompt(sevenDayStats);

  // Get responses with optional date filtering
  const defaultStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const startDate = dateFrom || defaultStart;
  const endDate = dateTo || new Date();
  const promptIds = prompts.map(p => p.id);
  
  let query = supabase
    .from('prompt_provider_responses')
    .select('prompt_id, run_at, score, status')
    .in('prompt_id', promptIds)
    .eq('status', 'success')
    .gte('run_at', startDate.toISOString());
    
  if (dateTo) {
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);
    query = query.lte('run_at', endOfDay.toISOString());
  }
  
  query = query.order('run_at', { ascending: true });

  const { data: responses, error: responsesError } = await query;

  if (responsesError) throw responsesError;

  return processUnifiedData(prompts, responses || [], responsesByPrompt, statsByPrompt);
}

/**
 * Standard data fetching (fallback when bulk queries disabled)
 */
async function getUnifiedDashboardDataStandard(
  orgId: string, 
  dateFrom?: Date, 
  dateTo?: Date
): Promise<UnifiedDashboardData> {
  // Original implementation logic
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

  // Get responses with optional date filtering
  const defaultStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const startDate = dateFrom || defaultStart;
  const endDate = dateTo || new Date();
  
  let query = supabase
    .from('prompt_provider_responses')
    .select('prompt_id, run_at, score, status')
    .in('prompt_id', promptIds)
    .eq('status', 'success')
    .gte('run_at', startDate.toISOString());
    
  if (dateTo) {
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);
    query = query.lte('run_at', endOfDay.toISOString());
  }
  
  query = query.order('run_at', { ascending: true });

  const { data: responses, error: responsesError } = await query;

  if (responsesError) throw responsesError;

  const validResponses = responses || [];

  // Calculate all metrics in one pass
  const now = new Date();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  // Last 7 days scores for avgScore
  const last7DaysForAvg = validResponses.filter(r => new Date(r.run_at) >= sevenDaysAgo);
  const avgScoreValues = last7DaysForAvg.map(r => r.score);

  const avgScore = avgScoreValues.length > 0 
    ? avgScoreValues.reduce((sum, s) => sum + s, 0) / avgScoreValues.length 
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

  // Get latest responses for calculating the additional metrics
  const { data: latestResponsesData } = await supabase
    .rpc('get_latest_prompt_provider_responses', { p_org_id: orgId });
  
  const latestResponses = latestResponsesData || [];

  // Helper function to get latest response per provider
  function getLatestResponsePerProvider(responses: any[]) {
    const byProvider: { [provider: string]: any } = {};
    responses.forEach(response => {
      if (!byProvider[response.provider] || 
          new Date(response.run_at) > new Date(byProvider[response.provider].run_at)) {
        byProvider[response.provider] = response;
      }
    });
    return byProvider;
  }

  // Prompt summaries with latest scores and additional metrics
  const promptSummaries = prompts.map(prompt => {
    const promptResponses = validResponses.filter(r => r.prompt_id === prompt.id);
    const sevenDayResponses = promptResponses.filter(
      r => new Date(r.run_at) >= sevenDaysAgo
    );
    
    const latestScore = promptResponses.length > 0 
      ? promptResponses[promptResponses.length - 1].score 
      : 0;

    // Get latest responses for this prompt from the detailed data
    const promptLatestResponses = latestResponses.filter(r => r.prompt_id === prompt.id);
    const latestResponsesByProvider = getLatestResponsePerProvider(promptLatestResponses);
    const latestResponseValues = Object.values(latestResponsesByProvider);

    // Calculate top metrics from latest responses
    const brandVisibleCount = latestResponseValues.filter((r: any) => r.org_brand_present).length;
    const competitorCount = latestResponseValues.reduce((sum: number, r: any) => sum + (r.competitors_count || 0), 0);
    const brandPresenceRate = latestResponseValues.length > 0 
      ? (brandVisibleCount / latestResponseValues.length) * 100 
      : 0;

    return {
      id: prompt.id,
      text: prompt.text,
      active: prompt.active,
      created_at: prompt.created_at,
      latestScore: Math.round(latestScore * 10) / 10,
      hasData: promptResponses.length > 0,
      org_id: prompt.org_id,
      runs7d: sevenDayResponses.length,
      avgScore7d: sevenDayResponses.length > 0
        ? sevenDayResponses.reduce((sum, r) => sum + r.score, 0) / sevenDayResponses.length
        : 0,
      brandVisibleCount,
      competitorCount,
      brandPresenceRate: Math.round(brandPresenceRate * 10) / 10,
      latestResponses: latestResponsesByProvider
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
    providers: providersResult.data || [],
    prompts: promptSummaries
  };
}

/**
 * Phase 2 Enhanced: Unified prompt data fetcher with ML integration and date filtering
 */
export async function getUnifiedPromptData(
  useCache = true, 
  dateFrom?: Date, 
  dateTo?: Date
): Promise<UnifiedPromptData> {
  try {
    const orgId = await getOrgId();
    const dateKey = dateFrom && dateTo ? `-${dateFrom.toISOString()}-${dateTo.toISOString()}` : '';
    const cacheKey = `prompt-data-${orgId}${dateKey}`;
    
    if (useCache && !dateFrom && !dateTo) {
      const cached = await advancedCache.get<UnifiedPromptData>(cacheKey);
      if (cached && isValidPromptData(cached)) {
        return cached;
      }
    }

    // Get base dashboard data with date filtering
    const dashboardData = await getUnifiedDashboardData(useCache, dateFrom, dateTo);
    const safePrompts = Array.isArray((dashboardData as any)?.prompts) ? (dashboardData as any).prompts : [];
    
    if (safePrompts.length === 0) {
      const emptyData: UnifiedPromptData = {
        ...dashboardData,
        prompts: [],
        promptDetails: []
      };
      advancedCache.set(cacheKey, emptyData, CACHE_TTL.prompts);
      return emptyData;
    }

    const promptIds = safePrompts.map(p => p.id);
    
    if (promptIds.length === 0) {
      const emptyData: UnifiedPromptData = {
        ...dashboardData,
        prompts: [],
        promptDetails: []
      };
      advancedCache.set(cacheKey, emptyData, CACHE_TTL.prompts);
      return emptyData;
    }

    // Get latest provider responses - when date filtering is active, get ALL responses in range
    let allResponses: any[] = [];
    let sevenDayData: any[] = [];
    let rawLatestResponses: any[] = [];
    let latestResponsesResult: any;
    let sevenDayResult: any;
    
    if (dateFrom || dateTo) {
      // Date filtering mode: get all responses in the range
      let responsesQuery = supabase
        .from('prompt_provider_responses')
        .select('id, prompt_id, provider, model, status, run_at, raw_ai_response, error, metadata, score, org_brand_present, org_brand_prominence, competitors_count, competitors_json, brands_json, citations_json, token_in, token_out')
        .in('prompt_id', promptIds)
        .in('status', ['success', 'completed']);
      
      if (dateFrom) {
        responsesQuery = responsesQuery.gte('run_at', dateFrom.toISOString());
      }
      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        responsesQuery = responsesQuery.lte('run_at', endOfDay.toISOString());
      }
      
      responsesQuery = responsesQuery.order('run_at', { ascending: false }).limit(1000);
      
      const { data: dateFilteredResponses, error: dateFilterError } = await responsesQuery;
      if (dateFilterError) throw dateFilterError;
      allResponses = dateFilteredResponses || [];
    } else {
      // Default mode: get latest responses per provider using RPC
      [latestResponsesResult, sevenDayResult] = await Promise.all([
        supabase
          .rpc('get_latest_prompt_provider_responses', { p_org_id: orgId }),
        supabase
          .rpc('get_prompt_visibility_7d', { requesting_org_id: orgId })
      ]);

      rawLatestResponses = (latestResponsesResult.data || []).filter((r: any) => promptIds.includes(r.prompt_id));
      sevenDayData = sevenDayResult.data || [];
      allResponses = rawLatestResponses;
    }

    // If RPC errored or returned no rows in default mode, fallback to direct table select
    if (!dateFrom && !dateTo && allResponses.length === 0) {
      let fallbackQuery = supabase
        .from('prompt_provider_responses')
        .select('id, prompt_id, provider, model, status, run_at, raw_ai_response, error, metadata, score, org_brand_present, org_brand_prominence, competitors_count, competitors_json, brands_json, citations_json, token_in, token_out')
        .in('prompt_id', promptIds)
        .order('run_at', { ascending: false })
        .limit(400);
      
      const { data: fallbackRows, error: fallbackError } = await fallbackQuery;
      if (!fallbackError && fallbackRows) {
        // Pick latest per (prompt_id, normalized_provider)
        const seen = new Set<string>();
        const normalized: any[] = [];
        for (const row of fallbackRows) {
          const providerNorm = row.provider === 'perplexity_ai' ? 'perplexity' : (row.provider === 'google_aio' ? 'google_ai_overview' : row.provider);
          const key = `${row.prompt_id}-${providerNorm}`;
          if (seen.has(key)) continue;
          seen.add(key);
          normalized.push({ ...row, provider: providerNorm });
        }
        allResponses = normalized.filter((r: any) => promptIds.includes(r.prompt_id));
      }
    }
    
    // Normalize provider names to canonical forms
    const normalizeProvider = (provider: string | undefined): string | null => {
      if (!provider) return null;
      const normalized = provider.toLowerCase().trim();
      
      // Provider name mappings
      const providerMap: Record<string, string> = {
        'perplexity_ai': 'perplexity',
        'perplexity ai': 'perplexity',
        'google': 'google_ai_overview',
        'google_aio': 'google_ai_overview',
        'google aio': 'google_ai_overview',
        'googleaio': 'google_ai_overview',
      };
      
      return providerMap[normalized] || normalized;
    };

    // Apply normalization to all responses and filter out any without valid provider
    const latestResponses = allResponses
      .map((r: any) => ({
        ...r,
        provider: normalizeProvider(r.provider) || r.provider
      }))
      .filter((r: any) => r.provider);

    // Process detailed prompt data
    // Create Map for O(1) lookup instead of O(n) filtering
    const responsesByPrompt = new Map<string, any[]>();
    latestResponses.forEach(r => {
      if (!responsesByPrompt.has(r.prompt_id)) {
        responsesByPrompt.set(r.prompt_id, []);
      }
      responsesByPrompt.get(r.prompt_id)!.push(r);
    });

    const promptDetails = safePrompts.map(prompt => {
      // Group responses by provider - in date filter mode, get all; otherwise get latest
      const promptResponses = responsesByPrompt.get(prompt.id) || [];
      
      let providerData: any = {};
      
      if (dateFrom || dateTo) {
        // Date filter mode: get ALL responses for stats, but return LATEST per provider for display
        const allResponsesByProvider = {
          openai: promptResponses.filter(r => r.provider === 'openai'),
          gemini: promptResponses.filter(r => r.provider === 'gemini'),
          perplexity: promptResponses.filter(r => r.provider === 'perplexity'),
          google_ai_overview: promptResponses.filter(r => r.provider === 'google_ai_overview'),
        };
        
        // Get the latest response per provider for display
        providerData = {
          openai: allResponsesByProvider.openai.sort((a, b) => new Date(b.run_at).getTime() - new Date(a.run_at).getTime())[0] || null,
          gemini: allResponsesByProvider.gemini.sort((a, b) => new Date(b.run_at).getTime() - new Date(a.run_at).getTime())[0] || null,
          perplexity: allResponsesByProvider.perplexity.sort((a, b) => new Date(b.run_at).getTime() - new Date(a.run_at).getTime())[0] || null,
          google_ai_overview: allResponsesByProvider.google_ai_overview.sort((a, b) => new Date(b.run_at).getTime() - new Date(a.run_at).getTime())[0] || null,
        };
        
        // Store all responses for aggregate calculations
        (providerData as any)._allResponses = allResponsesByProvider;
      } else {
        // Default mode: get latest per provider
        providerData = {
          openai: promptResponses.find(r => r.provider === 'openai') as ProviderResponseData || null,
          gemini: promptResponses.find(r => r.provider === 'gemini') as ProviderResponseData || null,
          perplexity: promptResponses.find(r => r.provider === 'perplexity') as ProviderResponseData || null,
          google_ai_overview: promptResponses.find(r => r.provider === 'google_ai_overview') as ProviderResponseData || null,
        };
      }

      // Calculate overall score from all provider responses
      let scores: number[] = [];
      
      if (dateFrom || dateTo) {
        // Date filter mode: calculate from ALL responses stored in _allResponses
        const allResponsesByProvider = (providerData as any)._allResponses;
        if (allResponsesByProvider) {
          Object.values(allResponsesByProvider).forEach((responses: any) => {
            if (Array.isArray(responses)) {
              responses.forEach(r => {
                if (r.status === 'success' || r.status === 'completed') {
                  scores.push(r.score);
                }
              });
            }
          });
        }
      } else {
        // Default mode: calculate from latest per provider
        scores = Object.values(providerData)
          .filter((p: any) => p && (p.status === 'success' || p.status === 'completed'))
          .map((p: any) => p.score);
      }
      
      const overallScore = scores.length > 0 
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length 
        : 0;

      // Get latest run time
      let lastRunAt: string | null = null;
      if (dateFrom || dateTo) {
        // Get most recent from all responses stored in _allResponses
        const allResponsesByProvider = (providerData as any)._allResponses;
        const allRunDates: string[] = [];
        if (allResponsesByProvider) {
          Object.values(allResponsesByProvider).forEach((responses: any) => {
            if (Array.isArray(responses)) {
              responses.forEach(r => allRunDates.push(r.run_at));
            }
          });
        }
        lastRunAt = allRunDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null;
      } else {
        lastRunAt = Object.values(providerData)
          .filter((p: any) => p?.run_at)
          .map((p: any) => p.run_at)
          .sort((a: any, b: any) => new Date(b).getTime() - new Date(a).getTime())[0] || null;
      }

      // Simplified competitor data
      const promptCompetitors: Array<{ name: string; count: number }> = [];

      // Calculate stats for the period (7-day default or custom date range)
      const periodStart = dateFrom || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const periodEnd = dateTo || new Date();
      
      let periodStats = { totalRuns: 0, avgScore: 0, brandPresenceRate: 0 };
      
      if (dateFrom || dateTo) {
        // Calculate from all responses in the date range stored in _allResponses
        let totalScore = 0;
        let scoreCount = 0;
        let brandPresentCount = 0;
        let totalResponses = 0;
        
        const allResponsesByProvider = (providerData as any)._allResponses;
        if (allResponsesByProvider) {
          Object.values(allResponsesByProvider).forEach((responses: any) => {
            if (Array.isArray(responses)) {
              responses.forEach((r: any) => {
                const runDate = new Date(r.run_at);
                if (runDate >= periodStart && runDate <= periodEnd) {
                  totalResponses++;
                  if (r.status === 'success' || r.status === 'completed') {
                    totalScore += r.score;
                    scoreCount++;
                    if (r.org_brand_present) {
                      brandPresentCount++;
                    }
                  }
                }
              });
            }
          });
        }
        
        periodStats = {
          totalRuns: totalResponses,
          avgScore: scoreCount > 0 ? totalScore / scoreCount : 0,
          brandPresenceRate: totalResponses > 0 ? (brandPresentCount / totalResponses) * 100 : 0
        };
      } else {
        // Use RPC 7-day stats
        const promptSevenDay = sevenDayData.find((s: any) => s.prompt_id === prompt.id);
        periodStats = {
          totalRuns: Number(promptSevenDay?.runs_7d || 0),
          avgScore: Number(promptSevenDay?.avg_score_7d || 0),
          brandPresenceRate: 0,
        };
      }

      return {
        promptId: prompt.id,
        promptText: prompt.text,
        active: prompt.active,
        providers: providerData,
        overallScore: Math.round(overallScore * 10) / 10,
        lastRunAt,
        sevenDayStats: periodStats,
        competitors: promptCompetitors,
        dateRange: dateFrom || dateTo ? { from: dateFrom, to: dateTo } : null
      };
    });

    // Update prompts in dashboard data with enhanced details
    const enhancedPrompts = dashboardData.prompts.map(prompt => {
      const detail = promptDetails.find(d => d.promptId === prompt.id);
      if (detail) {
        // Handle both single responses and arrays
        const getResponseValues = (providers: any) => {
          const values: any[] = [];
          Object.values(providers).forEach((val: any) => {
            if (Array.isArray(val)) {
              values.push(...val.filter((r: any) => r !== null));
            } else if (val !== null) {
              values.push(val);
            }
          });
          return values;
        };
        
        const latestResponseValues = getResponseValues(detail.providers);
        const brandVisibleCount = latestResponseValues.filter((r: any) => r.org_brand_present).length;
        const competitorCount = latestResponseValues.reduce((sum: number, r: any) => sum + (r.competitors_count || 0), 0);
        const brandPresenceRate = latestResponseValues.length > 0 
          ? (brandVisibleCount / latestResponseValues.length) * 100 
          : 0;

        return {
          ...prompt,
          runs7d: detail.sevenDayStats.totalRuns,
          avgScore7d: detail.sevenDayStats.avgScore,
          brandVisibleCount,
          competitorCount,
          brandPresenceRate: Math.round(brandPresenceRate * 10) / 10,
          latestResponses: detail.providers
        };
      }
      return {
        ...prompt,
        runs7d: 0,
        avgScore7d: 0,
        brandVisibleCount: 0,
        competitorCount: 0,
        brandPresenceRate: 0,
        latestResponses: {}
      };
    });

    const result: UnifiedPromptData = {
      ...dashboardData,
      prompts: enhancedPrompts,
      promptDetails
    };

    // Phase 2: Advanced caching with event-driven invalidation
    advancedCache.set(cacheKey, result, CACHE_TTL.prompts);
    return result;

  } catch (error) {
    console.error("Unified prompt data error:", error);
    throw error;
  }
}

/**
 * Phase 2: Enhanced cache invalidation with event-driven updates
 */
export function invalidateCache(keys?: string[]): void {
  if (keys) {
    keys.forEach(key => {
      const pattern = key.includes('*') ? key : `${key}*`;
      advancedCache.invalidate(pattern);
    });
    
    // Emit cache invalidation events for other components
    keys.forEach(key => {
      if (key.includes('prompt')) {
        cacheEventManager.emit('prompt-executed', { cacheKey: key });
      } else if (key.includes('brand')) {
        cacheEventManager.emit('brand-updated', { cacheKey: key });
      }
    });
  } else {
    // Clear all cache entries
    advancedCache.invalidate('*');
  }
}

/**
 * Phase 2: New advanced caching utilities
 */
export function getCacheStats() {
  return advancedCache.getStats();
}

export function warmCacheForUser() {
  backgroundPreloader.preloadCriticalData();
}

/**
 * Cache invalidation and UI refresh after brand classification fixes
 */
export function refreshAfterBrandFix() {
  // Clear all related caches
  invalidateCache(['dashboard-data', 'prompt-data', 'provider-data', 'competitors-data']);
  
  // Trigger cache warming for immediate UI responsiveness
  warmCacheForUser();
  
  // Emit events for real-time updates
  const eventManager = CacheEventManager.getInstance();
  eventManager.emit('brand-classification-updated', { 
    timestamp: Date.now(),
    reason: 'manual-fix-applied' 
  });
}

/**
 * Get individual prompt provider history (for expanded rows)
 */
export async function getPromptProviderHistory(
  promptId: string, 
  provider: string, 
  limit: number = 10
): Promise<ProviderResponseData[]> {
  const cacheKey = `history-${promptId}-${provider}`;
  const cached = await getCachedData<ProviderResponseData[]>(cacheKey);
  if (cached) return cached;

  try {
    const { data, error } = await supabase
      .from('prompt_provider_responses')
      .select('*')
      .eq('prompt_id', promptId)
      .eq('provider', provider)
      .order('run_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const result = (data as ProviderResponseData[]) || [];
    // Phase 2: Advanced caching for provider history
    advancedCache.set(cacheKey, result, CACHE_TTL.providers);
    return result;
  } catch (error) {
    console.error(`Error fetching ${provider} history for prompt ${promptId}:`, error);
    throw error;
  }
}