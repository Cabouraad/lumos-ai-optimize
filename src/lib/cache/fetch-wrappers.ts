/**
 * Cache-Aware Data Fetch Wrappers
 * 
 * SAFETY: These are wrapper functions that add caching to existing fetchers.
 * Original functions remain unchanged as guaranteed fallback.
 * Components can choose cached vs direct version.
 */

import { optimizationFlags, withFeatureFlag } from '@/config/featureFlags';
import { responseCache } from '@/lib/cache/response-cache';
import { processUnifiedData, getProviders } from '@/lib/data/dashboard-helpers';
import { supabase } from '@/integrations/supabase/client';
import type { UnifiedDashboardData } from '@/lib/data/unified-fetcher';

interface CacheOptions {
  ttl?: number; // Time to live in ms
  skipCache?: boolean; // Force fresh fetch
  cacheKey?: string; // Custom cache key
}

/**
 * Cached wrapper for dashboard data fetching
 * Falls back to original function on any error
 */
export async function getCachedDashboardData(
  orgId: string,
  options: CacheOptions = {}
): Promise<UnifiedDashboardData> {
    return withFeatureFlag(
      'FEATURE_DATA_FETCH_CACHE',
    async () => {
      const { ttl = 60000, skipCache = false, cacheKey } = options;
      const key = cacheKey || `dashboard:${orgId}`;

      // Try cache first (unless skipped)
      if (!skipCache) {
        const cached = responseCache.get<UnifiedDashboardData>(key);
        if (cached) {
          console.log('[CachedFetch] Dashboard data from cache');
          return cached;
        }
      }

      // Fetch fresh data using original logic
      const data = await fetchDashboardDataOriginal(orgId);
      
      // Cache the result
      responseCache.set(key, data, ttl);
      console.log('[CachedFetch] Dashboard data cached');
      
      return data;
    },
    () => fetchDashboardDataOriginal(orgId), // Fallback to original
    'dashboard-data-cache'
  );
}

/**
 * Cached wrapper for provider data
 * Safe fallback to original function
 */
export async function getCachedProviders(options: CacheOptions = {}) {
    return withFeatureFlag(
      'FEATURE_DATA_FETCH_CACHE',
    async () => {
      const { ttl = 300000, skipCache = false } = options; // 5 min default TTL
      const key = 'providers:list';

      if (!skipCache) {
        const cached = responseCache.get<any[]>(key);
        if (cached) {
          console.log('[CachedFetch] Providers from cache');
          return cached;
        }
      }

      // Use original function
      const providers = await getProviders();
      responseCache.set(key, providers, ttl);
      console.log('[CachedFetch] Providers cached');
      
      return providers;
    },
    () => getProviders(), // Fallback to original
    'providers-cache'
  );
}

/**
 * Cached wrapper for prompt responses
 * Original query logic preserved
 */
export async function getCachedPromptResponses(
  orgId: string, 
  options: CacheOptions = {}
) {
    return withFeatureFlag(
      'FEATURE_DATA_FETCH_CACHE',
    async () => {
      const { ttl = 30000, skipCache = false } = options; // 30 sec default
      const key = `responses:${orgId}`;

      if (!skipCache) {
        const cached = responseCache.get<any[]>(key);
        if (cached) {
          console.log('[CachedFetch] Responses from cache');
          return cached;
        }
      }

      // Original Supabase query
      const { data: responses } = await supabase
        .from('prompt_provider_responses')
        .select(`
          id, prompt_id, provider, raw_ai_response, score,
          run_at, org_brand_present, competitors_count,
          error
        `)
        .eq('org_id', orgId)
        .order('run_at', { ascending: false });

      const result = responses || [];
      responseCache.set(key, result, ttl);
      console.log('[CachedFetch] Responses cached');
      
      return result;
    },
    async () => {
      // Fallback: Original query without caching
      const { data: responses } = await supabase
        .from('prompt_provider_responses')
        .select(`
          id, prompt_id, provider, raw_ai_response, score,
          run_at, org_brand_present, competitors_count,
          error
        `)
        .eq('org_id', orgId)
        .order('run_at', { ascending: false });

      return responses || [];
    },
    'responses-cache'
  );
}

/**
 * Original dashboard data fetching function (preserved exactly)
 * This ensures we have the exact same logic as the original
 */
async function fetchDashboardDataOriginal(orgId: string): Promise<UnifiedDashboardData> {
  // Get prompts
  const { data: prompts } = await supabase
    .from('prompts')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  // Get responses  
  const { data: responses } = await supabase
    .from('prompt_provider_responses')
    .select(`
      id, prompt_id, provider, raw_ai_response, score,
      run_at, org_brand_present, competitors_count,
      error
    `)
    .eq('org_id', orgId)
    .order('run_at', { ascending: false });

  const validResponses = (responses || []).filter(r => 
    r.score !== null && r.score !== undefined && !isNaN(r.score)
  );

  // Process data using existing logic
  const responsesByPrompt = new Map<string, any[]>();
  const statsByPrompt = new Map<string, any>();

  validResponses.forEach(response => {
    if (!responsesByPrompt.has(response.prompt_id)) {
      responsesByPrompt.set(response.prompt_id, []);
    }
    responsesByPrompt.get(response.prompt_id)!.push(response);
  });

  return processUnifiedData(
    prompts || [],
    validResponses,
    responsesByPrompt,
    statsByPrompt
  );
}

/**
 * Invalidate cache for specific keys or patterns
 * Useful for forced refresh scenarios
 */
export function invalidateCache(pattern?: string): void {
  if (!optimizationFlags.FEATURE_DATA_FETCH_CACHE) return;
  
  if (pattern) {
    console.log(`[CacheInvalidation] Invalidating pattern: ${pattern}`);
    // For now, just clear request cache
    // Could be enhanced to clear specific patterns
    responseCache.clearRequestCache();
  } else {
    console.log('[CacheInvalidation] Clearing all cache');
    responseCache.clearRequestCache();
  }
}