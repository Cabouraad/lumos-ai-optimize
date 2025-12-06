/**
 * Cache-Aware Data Fetch Wrappers
 * 
 * SAFETY: These are wrapper functions that add caching to existing fetchers.
 * Original functions remain unchanged as guaranteed fallback.
 * Components can choose cached vs direct version.
 * 
 * BRAND ISOLATION: Cache keys include brandId to prevent data bleeding between brands.
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
  brandId?: string; // Brand ID for multi-brand isolation
}

/**
 * Generate brand-scoped cache key
 * When brandId is provided, cache is isolated per brand
 * When not provided, uses 'org' suffix for org-level caching
 */
function getBrandScopedKey(base: string, orgId: string, brandId?: string): string {
  return `${base}:${orgId}:${brandId || 'org'}`;
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
      const { ttl = 60000, skipCache = false, cacheKey, brandId } = options;
      const key = cacheKey || getBrandScopedKey('dashboard', orgId, brandId);

      // Try cache first (unless skipped)
      if (!skipCache) {
        const cached = responseCache.get<UnifiedDashboardData>(key);
        if (cached) {
          console.log('[CachedFetch] Dashboard data from cache', { key, brandId: brandId || 'org-level' });
          return cached;
        }
      }

      // Fetch fresh data using original logic
      const data = await fetchDashboardDataOriginal(orgId, brandId);
      
      // Cache the result
      responseCache.set(key, data, ttl);
      console.log('[CachedFetch] Dashboard data cached', { key, brandId: brandId || 'org-level' });
      
      return data;
    },
    () => fetchDashboardDataOriginal(orgId, options.brandId), // Fallback to original
    'dashboard-data-cache'
  );
}

/**
 * Cached wrapper for provider data
 * Safe fallback to original function
 * Note: Providers are org-level, no brand isolation needed
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
 * Original query logic preserved with brand isolation
 */
export async function getCachedPromptResponses(
  orgId: string, 
  options: CacheOptions = {}
) {
    return withFeatureFlag(
      'FEATURE_DATA_FETCH_CACHE',
    async () => {
      const { ttl = 30000, skipCache = false, brandId } = options; // 30 sec default
      const key = getBrandScopedKey('responses', orgId, brandId);

      if (!skipCache) {
        const cached = responseCache.get<any[]>(key);
        if (cached) {
          console.log('[CachedFetch] Responses from cache', { key, brandId: brandId || 'org-level' });
          return cached;
        }
      }

      // Build query with optional brand filter
      let query = supabase
        .from('prompt_provider_responses')
        .select(`
          id, prompt_id, provider, raw_ai_response, score,
          run_at, org_brand_present, competitors_count,
          error
        `)
        .eq('org_id', orgId)
        .order('run_at', { ascending: false });

      // If brandId provided, join with prompts to filter by brand
      if (brandId) {
        // Need to use a different approach - filter via prompt_id in a subquery
        const { data: brandPromptIds } = await supabase
          .from('prompts')
          .select('id')
          .eq('org_id', orgId)
          .eq('brand_id', brandId);
        
        if (brandPromptIds && brandPromptIds.length > 0) {
          const promptIds = brandPromptIds.map(p => p.id);
          query = query.in('prompt_id', promptIds);
        } else {
          // No prompts for this brand, return empty
          responseCache.set(key, [], ttl);
          return [];
        }
      }

      const { data: responses } = await query;

      const result = responses || [];
      responseCache.set(key, result, ttl);
      console.log('[CachedFetch] Responses cached', { key, brandId: brandId || 'org-level', count: result.length });
      
      return result;
    },
    async () => {
      // Fallback: Original query without caching but with brand filter support
      const { brandId } = options;
      
      let query = supabase
        .from('prompt_provider_responses')
        .select(`
          id, prompt_id, provider, raw_ai_response, score,
          run_at, org_brand_present, competitors_count,
          error
        `)
        .eq('org_id', orgId)
        .order('run_at', { ascending: false });

      if (brandId) {
        const { data: brandPromptIds } = await supabase
          .from('prompts')
          .select('id')
          .eq('org_id', orgId)
          .eq('brand_id', brandId);
        
        if (brandPromptIds && brandPromptIds.length > 0) {
          query = query.in('prompt_id', brandPromptIds.map(p => p.id));
        } else {
          return [];
        }
      }

      const { data: responses } = await query;
      return responses || [];
    },
    'responses-cache'
  );
}

/**
 * Original dashboard data fetching function (preserved exactly)
 * Now supports optional brandId for brand-specific filtering
 */
async function fetchDashboardDataOriginal(orgId: string, brandId?: string): Promise<UnifiedDashboardData> {
  // Get prompts with optional brand filter
  let promptsQuery = supabase
    .from('prompts')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (brandId) {
    promptsQuery = promptsQuery.eq('brand_id', brandId);
  }

  const { data: prompts } = await promptsQuery;

  // Get responses - if brandId provided, filter via prompt_ids
  let responsesQuery = supabase
    .from('prompt_provider_responses')
    .select(`
      id, prompt_id, provider, raw_ai_response, score,
      run_at, org_brand_present, competitors_count,
      error
    `)
    .eq('org_id', orgId)
    .order('run_at', { ascending: false });

  if (brandId && prompts && prompts.length > 0) {
    const promptIds = prompts.map(p => p.id);
    responsesQuery = responsesQuery.in('prompt_id', promptIds);
  } else if (brandId) {
    // Brand has no prompts, return empty data
    return processUnifiedData([], [], new Map(), new Map());
  }

  const { data: responses } = await responsesQuery;

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
 * Supports brand-specific invalidation
 */
export function invalidateCache(pattern?: string, brandId?: string): void {
  if (!optimizationFlags.FEATURE_DATA_FETCH_CACHE) return;
  
  if (pattern) {
    const suffix = brandId ? `:${brandId}` : '';
    console.log(`[CacheInvalidation] Invalidating pattern: ${pattern}${suffix}`);
    responseCache.clearRequestCache();
  } else {
    console.log('[CacheInvalidation] Clearing all cache');
    responseCache.clearRequestCache();
  }
}
