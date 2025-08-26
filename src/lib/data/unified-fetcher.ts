/**
 * Phase 2 Enhanced: Unified data fetcher with advanced caching and ML integration
 */
import { supabase } from "@/integrations/supabase/client";
import { getOrgId } from "@/lib/auth";
import { advancedCache, CacheEventManager } from "../advanced-cache/redis-cache";
import { backgroundPreloader } from "../background-optimization/data-preloader";

// Initialize Phase 2 cache event management
const cacheEventManager = CacheEventManager.getInstance();

const CACHE_TTL = {
  dashboard: 2 * 60 * 1000, // 2 minutes
  prompts: 1 * 60 * 1000,   // 1 minute
  providers: 5 * 60 * 1000,  // 5 minutes
};

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
 * Phase 2 Enhanced: Unified data fetcher with background preloading
 */
export async function getUnifiedDashboardData(useCache = true): Promise<UnifiedDashboardData> {
  try {
    const orgId = await getOrgId();
    const cacheKey = `dashboard-data-${orgId}`;
    
    if (useCache) {
      // Check Phase 2 advanced cache first
      const cached = await advancedCache.get<UnifiedDashboardData>(cacheKey);
      if (cached) return cached;
    }

    // Trigger Phase 2 background preloading for future requests
    backgroundPreloader.preloadCriticalData();

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

    console.log('🔍 Debug: Prompts query result:', {
      error: promptsResult.error,
      dataLength: promptsResult.data?.length || 0,
      orgId: orgId
    });

    if (promptsResult.error) {
      console.error('🔍 Debug: Prompts query error:', promptsResult.error);
      throw promptsResult.error;
    }
    if (providersResult.error) throw providersResult.error;

    const prompts = promptsResult.data || [];
    const providers = providersResult.data || [];
    const promptIds = prompts.map(p => p.id);

    console.log('🔍 Debug: Processing prompts data:', {
      promptsCount: prompts.length,
      providersCount: providers.length,
      promptIds: promptIds.slice(0, 3),
      firstPrompt: prompts[0]
    });

    if (promptIds.length === 0) {
      const emptyData: UnifiedDashboardData = {
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
      setCachedData(cacheKey, emptyData, CACHE_TTL.dashboard);
      return emptyData;
    }

    // Get all responses for the last 30 days in one query
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

    // Calculate all metrics in one pass
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

    const result: UnifiedDashboardData = {
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

    // Phase 2: Use advanced cache with event-driven invalidation
    advancedCache.set(cacheKey, result, CACHE_TTL.dashboard);
    return result;

  } catch (error) {
    console.error("Unified dashboard data error:", error);
    throw error;
  }
}

/**
 * Phase 2 Enhanced: Unified prompt data fetcher with ML integration
 */
export async function getUnifiedPromptData(useCache = true): Promise<UnifiedPromptData> {
  try {
    const orgId = await getOrgId();
    const cacheKey = `prompt-data-${orgId}`;
    
    if (useCache) {
      // Check Phase 2 advanced cache first
      const cached = await advancedCache.get<UnifiedPromptData>(cacheKey);
      if (cached) return cached;
    }

    // Get base dashboard data
    const dashboardData = await getUnifiedDashboardData(useCache);
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

      // Simplified competitor data (removed individual mention tracking)
      const promptCompetitors: Array<{ name: string; count: number }> = [];

      // Get 7-day stats
      const promptSevenDay = sevenDayData.find((s: any) => s.prompt_id === prompt.id);
      const sevenDayStats = {
        totalRuns: Number(promptSevenDay?.runs_7d || 0),
        avgScore: Number(promptSevenDay?.avg_score_7d || 0),
        brandPresenceRate: 0, // TODO: Calculate if needed
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

    const result: UnifiedPromptData = {
      ...dashboardData,
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
    keys.forEach(key => advancedCache.invalidate(key));
    
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