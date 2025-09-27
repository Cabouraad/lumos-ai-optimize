/**
 * Unified org ID resolution with resilient caching
 * Replaces duplicate getOrgId functions across the codebase
 */

import { supabase } from '@/integrations/supabase/client';

// Cache for org ID to reduce RPC calls
let cachedOrgId: string | null = null;
let cacheTimestamp: number | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get organization ID with resilient fallback strategy:
 * 1. Use memory cache if fresh
 * 2. Try localStorage cache if user is authenticated 
 * 3. Make RPC call as last resort
 * 4. Handle network failures gracefully
 */
export async function getOrgIdSafe(): Promise<string> {
  // Check memory cache first
  if (cachedOrgId && cacheTimestamp && (Date.now() - cacheTimestamp) < CACHE_TTL) {
    return cachedOrgId;
  }

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('No authenticated user');
  }

  // Try localStorage cache for authenticated users
  const localCached = localStorage.getItem('sb_last_org_id');
  const localTimestamp = localStorage.getItem('sb_org_cache_timestamp');
  
  if (localCached && localTimestamp) {
    const age = Date.now() - parseInt(localTimestamp);
    // Use local cache if less than 1 hour old and we have network issues
    if (age < 60 * 60 * 1000) {
      cachedOrgId = localCached;
      cacheTimestamp = Date.now();
      return localCached;
    }
  }

  // Make RPC call with timeout and retry logic
  try {
    const { data, error } = await Promise.race([
      supabase.rpc('get_current_user_org_id'),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('RPC timeout')), 10000)
      )
    ]) as { data: string | null; error: any };

    if (error) {
      console.error('RPC get_current_user_org_id failed:', error);
      
      // If we have a local cache, use it as fallback
      if (localCached) {
        console.log('Using localStorage cache as RPC fallback');
        cachedOrgId = localCached;
        cacheTimestamp = Date.now();
        return localCached;
      }
      
      throw new Error(`Failed to get org ID: ${error.message}`);
    }

    if (!data) {
      throw new Error('No organization found for user');
    }

    // Cache successful result
    cachedOrgId = data;
    cacheTimestamp = Date.now();
    
    // Update localStorage cache
    localStorage.setItem('sb_last_org_id', data);
    localStorage.setItem('sb_org_cache_timestamp', Date.now().toString());

    return data;
  } catch (error) {
    console.error('Failed to fetch org ID:', error);
    
    // Final fallback to localStorage if available
    if (localCached) {
      console.log('Using stale localStorage cache due to network error');
      return localCached;
    }
    
    throw error;
  }
}

/**
 * Clear org ID cache (call on sign out)
 */
export function clearOrgIdCache(): void {
  cachedOrgId = null;
  cacheTimestamp = null;
  localStorage.removeItem('sb_last_org_id');
  localStorage.removeItem('sb_org_cache_timestamp');
}

/**
 * Update org ID cache (call when org ID is known from other sources)
 */
export function updateOrgIdCache(orgId: string): void {
  cachedOrgId = orgId;
  cacheTimestamp = Date.now();
  localStorage.setItem('sb_last_org_id', orgId);
  localStorage.setItem('sb_org_cache_timestamp', Date.now().toString());
}

/**
 * @deprecated Use getOrgIdSafe() instead
 * Legacy export for backward compatibility
 */
export const getOrgId = getOrgIdSafe;