/**
 * Org Overlay Management  
 * Handles per-org competitor overrides and brand variants
 * Note: Uses a simple JSON field approach for now - in production would use dedicated tables
 */

import { supabase } from '@/integrations/supabase/client';

export interface OrgOverlay {
  org_id: string;
  competitor_overrides: string[]; // Manual competitor additions
  competitor_exclusions: string[]; // Manual competitor removals  
  brand_variants: string[]; // Additional org brand variants
  last_updated: Date;
}

// Cache for org overlays (function lifetime only)
const overlayCache = new Map<string, { overlay: OrgOverlay; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch org overlay with caching
 * Fetches exclusions from the org_competitor_exclusions table
 */
export async function getOrgOverlay(orgId: string): Promise<OrgOverlay> {
  // Check cache first
  const cached = overlayCache.get(orgId);
  if (cached && cached.expires > Date.now()) {
    return cached.overlay;
  }

  try {
    // Fetch exclusions from database
    const { data: exclusions, error } = await supabase
      .from('org_competitor_exclusions')
      .select('competitor_name')
      .eq('org_id', orgId);

    if (error) {
      console.error('Error fetching org exclusions:', error);
    }

    const overlay: OrgOverlay = {
      org_id: orgId,
      competitor_overrides: [],
      competitor_exclusions: exclusions?.map(e => e.competitor_name) || [],
      brand_variants: [],
      last_updated: new Date()
    };

    // Cache the result
    overlayCache.set(orgId, {
      overlay,
      expires: Date.now() + CACHE_TTL
    });

    return overlay;
  } catch (error) {
    console.error('Error in getOrgOverlay:', error);
    
    // Return empty overlay on error
    return {
      org_id: orgId,
      competitor_overrides: [],
      competitor_exclusions: [],
      brand_variants: [],
      last_updated: new Date()
    };
  }
}

/**
 * Update org overlay 
 * For now, just updates cache - in production would persist to database
 */
export async function updateOrgOverlay(orgId: string, updates: Partial<OrgOverlay>): Promise<void> {
  try {
    // For now, just update cache since we don't have a metadata field
    const currentOverlay = await getOrgOverlay(orgId);
    
    const updatedOverlay: OrgOverlay = {
      ...currentOverlay,
      ...updates,
      last_updated: new Date()
    };

    // Update cache
    overlayCache.set(orgId, {
      overlay: updatedOverlay,
      expires: Date.now() + CACHE_TTL
    });
    
    console.log(`✅ Updated org overlay for ${orgId} (cache only)`);
  } catch (error) {
    console.error('Error updating org overlay:', error);
    throw error;
  }
}

/**
 * Add competitor override (manual addition)
 */
export async function addCompetitorOverride(orgId: string, competitor: string): Promise<void> {
  const overlay = await getOrgOverlay(orgId);
  
  if (!overlay.competitor_overrides.includes(competitor)) {
    overlay.competitor_overrides.push(competitor);
    await updateOrgOverlay(orgId, { competitor_overrides: overlay.competitor_overrides });
  }
}

/**
 * Add competitor exclusion (manual removal)
 */
export async function addCompetitorExclusion(orgId: string, competitor: string): Promise<void> {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    
    // Insert into database (using upsert to handle duplicates)
    const { error } = await supabase
      .from('org_competitor_exclusions')
      .upsert(
        { 
          org_id: orgId, 
          competitor_name: competitor,
          excluded_by: user?.id 
        },
        { onConflict: 'org_id,competitor_name' }
      );

    if (error) {
      console.error('Error adding competitor exclusion:', error);
      throw error;
    }

    // Clear cache for this org to force refresh
    overlayCache.delete(orgId);
  } catch (error) {
    console.error('Failed to add competitor exclusion:', error);
    throw error;
  }
}

/**
 * Remove competitor override
 */
export async function removeCompetitorOverride(orgId: string, competitor: string): Promise<void> {
  const overlay = await getOrgOverlay(orgId);
  const filtered = overlay.competitor_overrides.filter(c => c !== competitor);
  
  if (filtered.length !== overlay.competitor_overrides.length) {
    await updateOrgOverlay(orgId, { competitor_overrides: filtered });
  }
}

/**
 * Remove competitor exclusion
 */
export async function removeCompetitorExclusion(orgId: string, competitor: string): Promise<void> {
  const overlay = await getOrgOverlay(orgId);
  const filtered = overlay.competitor_exclusions.filter(c => c !== competitor);
  
  if (filtered.length !== overlay.competitor_exclusions.length) {
    await updateOrgOverlay(orgId, { competitor_exclusions: filtered });
  }
}

/**
 * Clear cache for org (useful for testing)
 */
export function clearOrgOverlayCache(orgId?: string): void {
  if (orgId) {
    overlayCache.delete(orgId);
  } else {
    overlayCache.clear();
  }
}

/**
 * Get cross-provider consensus data
 */
export async function getCrossProviderConsensus(promptId: string, hours: number = 24): Promise<string[]> {
  try {
    const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const { data, error } = await supabase
      .from('prompt_provider_responses')
      .select('competitors_json, provider')
      .eq('prompt_id', promptId)
      .gte('run_at', cutoffDate.toISOString())
      .eq('status', 'success')
      .not('competitors_json', 'is', null);

    if (error) {
      console.error('Error fetching cross-provider consensus:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Count competitor mentions across providers
    const competitorCounts = new Map<string, Set<string>>();
    
    for (const response of data) {
      const competitors = Array.isArray(response.competitors_json) 
        ? response.competitors_json as string[]
        : [];
        
      for (const competitor of competitors) {
        if (!competitorCounts.has(competitor)) {
          competitorCounts.set(competitor, new Set());
        }
        competitorCounts.get(competitor)!.add(response.provider);
      }
    }

    // Return competitors that appear in multiple providers
    const consensusCompetitors: string[] = [];
    const providerThreshold = Math.max(2, Math.ceil(data.length * 0.5)); // At least 2 providers or 50%
    
    for (const [competitor, providers] of competitorCounts) {
      if (providers.size >= providerThreshold) {
        consensusCompetitors.push(competitor);
      }
    }

    return consensusCompetitors;
  } catch (error) {
    console.error('Error in getCrossProviderConsensus:', error);
    return [];
  }
}

export default {
  getOrgOverlay,
  updateOrgOverlay,
  addCompetitorOverride,
  addCompetitorExclusion,
  removeCompetitorOverride,
  removeCompetitorExclusion,
  clearOrgOverlayCache,
  getCrossProviderConsensus
};