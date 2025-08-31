/**
 * Bulk query optimization for reducing N+1 database access patterns
 * Only active when FEATURE_BULK_QUERIES is enabled
 */

import { supabase } from "@/integrations/supabase/client";
import { getOrgId } from "@/lib/auth";
import { isOptimizationFeatureEnabled, logFeatureFlagUsage } from "@/config/featureFlags";

export interface BulkPromptData {
  prompts: Array<{
    id: string;
    text: string;
    active: boolean;
    created_at: string;
    org_id: string;
  }>;
  
  latestResponses: Array<{
    id: string;
    prompt_id: string;
    provider: string;
    run_at: string;
    score: number;
    status: string;
    org_brand_present: boolean;
    competitors_count: number;
    competitors_json: string[];
    brands_json: string[];
  }>;
  
  sevenDayStats: Array<{
    prompt_id: string;
    runs_7d: number;
    avg_score_7d: number;
  }>;
}

/**
 * Fetch all prompt data in a single optimized query batch
 * Replaces multiple individual queries with coordinated bulk fetching
 */
export async function getBulkPromptData(): Promise<BulkPromptData> {
  if (!isOptimizationFeatureEnabled('FEATURE_BULK_QUERIES')) {
    throw new Error('Bulk queries not enabled - use standard data fetching');
  }
  
  logFeatureFlagUsage('FEATURE_BULK_QUERIES', 'getBulkPromptData');
  
  const orgId = await getOrgId();
  
  // Single batch: Get prompts + latest responses + 7-day stats in parallel
  const [promptsResult, latestResponsesResult, statsResult] = await Promise.all([
    // Prompts for org
    supabase
      .from("prompts")
      .select("id, text, active, created_at, org_id")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
    
    // Latest responses via optimized RPC (already batched)
    supabase.rpc('get_latest_prompt_provider_responses_catalog_only', { 
      p_org_id: orgId 
    }),
    
    // 7-day stats via optimized RPC (already batched)  
    supabase.rpc('get_prompt_visibility_7d', { 
      requesting_org_id: orgId 
    })
  ]);
  
  if (promptsResult.error) throw promptsResult.error;
  if (latestResponsesResult.error) throw latestResponsesResult.error;
  if (statsResult.error) throw statsResult.error;
  
  return {
    prompts: promptsResult.data || [],
    latestResponses: [], // latestResponsesResult.data || [], // Temporarily disabled
    sevenDayStats: statsResult.data || []
  };
}

/**
 * Pre-group responses by prompt_id for O(1) lookup
 * Eliminates O(n²) filtering in prompt processing
 */
export function groupResponsesByPrompt(responses: BulkPromptData['latestResponses']) {
  const responseMap = new Map<string, BulkPromptData['latestResponses']>();
  
  responses.forEach(response => {
    if (!responseMap.has(response.prompt_id)) {
      responseMap.set(response.prompt_id, []);
    }
    responseMap.get(response.prompt_id)!.push(response);
  });
  
  return responseMap;
}

/**
 * Pre-group stats by prompt_id for O(1) lookup
 */
export function groupStatsByPrompt(stats: BulkPromptData['sevenDayStats']) {
  const statsMap = new Map<string, BulkPromptData['sevenDayStats'][0]>();
  
  stats.forEach(stat => {
    statsMap.set(stat.prompt_id, stat);
  });
  
  return statsMap;
}

/**
 * Batch competitor data fetching for multiple prompts
 * Reduces individual RPC calls from N to 1
 */
export async function getBulkCompetitorData(promptIds: string[]) {
  if (!isOptimizationFeatureEnabled('FEATURE_BULK_QUERIES')) {
    throw new Error('Bulk queries not enabled');
  }
  
  if (promptIds.length === 0) return new Map();
  
  // Use a batch RPC or optimized query for multiple prompts
  const { data, error } = await supabase
    .from('prompt_provider_responses')
    .select('prompt_id, competitors_json')
    .in('prompt_id', promptIds)
    .eq('status', 'success')
    .gte('run_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
  
  if (error) throw error;
  
  // Group competitor data by prompt
  const competitorMap = new Map<string, Array<{ name: string; count: number }>>();
  
  (data || []).forEach(response => {
    if (!competitorMap.has(response.prompt_id)) {
      competitorMap.set(response.prompt_id, []);
    }
    
    const competitors = response.competitors_json || [];
    const competitorCounts = new Map<string, number>();
    
    if (Array.isArray(competitors)) {
      competitors.forEach((comp: string) => {
        competitorCounts.set(comp, (competitorCounts.get(comp) || 0) + 1);
      });
    }
    
    const currentCompetitors = competitorMap.get(response.prompt_id)!;
    competitorCounts.forEach((count, name) => {
      const existing = currentCompetitors.find(c => c.name === name);
      if (existing) {
        existing.count += count;
      } else {
        currentCompetitors.push({ name, count });
      }
    });
  });
  
  return competitorMap;
}