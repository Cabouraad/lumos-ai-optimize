
/**
 * Unified RPC-based data fetcher for optimal performance
 * Uses single database call instead of multiple queries
 */

import { supabase } from "@/integrations/supabase/client";
import { logger } from '../observability/logger';

export interface UnifiedDashboardResponse {
  success: boolean;
  error?: string;
  noOrg?: boolean; // Indicates user has no organization (not an error, needs onboarding)
  prompts: any[];
  responses: any[];
  chartData: any[];
  metrics: {
    avgScore: number;
    overallScore: number;
    trend: number;
    promptCount: number;
    activePrompts: number;
    inactivePrompts: number;
    totalRuns: number;
    recentRunsCount: number;
  };
  timestamp: string;
}

/**
 * Fetch all dashboard data in a single optimized RPC call
 */
export async function getUnifiedDashboardDataRPC(brandId?: string | null): Promise<UnifiedDashboardResponse> {
  const startTime = Date.now();
  
  try {
    logger.info('Fetching unified dashboard data via RPC', { 
      component: 'unified-rpc-fetcher',
      metadata: { brandId }
    });
    
    // Get current user's org_id using maybeSingle to avoid errors
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      logger.warn('No authenticated user found', { component: 'unified-rpc-fetcher' });
      return {
        success: false,
        error: 'Not authenticated',
        prompts: [],
        responses: [],
        chartData: [],
        metrics: {
          avgScore: 0,
          overallScore: 0,
          trend: 0,
          promptCount: 0,
          activePrompts: 0,
          inactivePrompts: 0,
          totalRuns: 0,
          recentRunsCount: 0
        },
        timestamp: new Date().toISOString()
      };
    }
    
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .maybeSingle();
    
    // If no user record or no org_id, return structured "no org" response
    if (userError || !userData || !userData.org_id) {
      logger.info('User has no organization - needs onboarding', { 
        component: 'unified-rpc-fetcher',
        metadata: { 
          hasUserRecord: !!userData,
          hasOrgId: !!userData?.org_id,
          userError: userError?.message 
        }
      });
      
      return {
        success: false,
        noOrg: true,
        error: 'No organization found',
        prompts: [],
        responses: [],
        chartData: [],
        metrics: {
          avgScore: 0,
          overallScore: 0,
          trend: 0,
          promptCount: 0,
          activePrompts: 0,
          inactivePrompts: 0,
          totalRuns: 0,
          recentRunsCount: 0
        },
        timestamp: new Date().toISOString()
      };
    }
    
    const { data, error } = await supabase.rpc('get_unified_dashboard_data', {
      p_org_id: userData.org_id,
      p_brand_id: brandId || null
    });
    
    const fetchTime = Date.now() - startTime;
    
    if (error) {
      logger.error('RPC fetch failed', error, { 
        component: 'unified-rpc-fetcher',
        metadata: { fetchTimeMs: fetchTime, error: error.message }
      });
      throw new Error(`Database error: ${error.message}`);
    }

    // Validate that we received data
    if (!data) {
      logger.error('RPC returned null data', new Error('No data returned'), { 
        component: 'unified-rpc-fetcher',
        metadata: { fetchTimeMs: fetchTime }
      });
      throw new Error('No data returned from database');
    }

    const result = data as any;
    
    // Check if the RPC returned an error structure
    if (result && typeof result === 'object' && result.success === false) {
      const errorMsg = result.error || 'Unknown RPC error';
      logger.error('RPC returned error response', new Error(errorMsg), { 
        component: 'unified-rpc-fetcher',
        metadata: { fetchTimeMs: fetchTime, rpcError: errorMsg }
      });
      throw new Error(`Dashboard data error: ${errorMsg}`);
    }

    // Validate the structure of successful response
    if (!result || typeof result !== 'object') {
      logger.error('RPC returned invalid structure', new Error('Invalid response structure'), { 
        component: 'unified-rpc-fetcher',
        metadata: { fetchTimeMs: fetchTime, resultType: typeof result }
      });
      throw new Error('Invalid response structure from database');
    }

    // Ensure we have the expected properties
    const safeResult = {
      success: true,
      prompts: Array.isArray(result.prompts) ? result.prompts : [],
      responses: Array.isArray(result.responses) ? result.responses : [],
      chartData: Array.isArray(result.chartData) ? result.chartData : [],
      metrics: result.metrics && typeof result.metrics === 'object' 
        ? {
            avgScore: Number(result.metrics.avgScore) || 0,
            overallScore: Number(result.metrics.overallScore) || 0,
            trend: Number(result.metrics.trend) || 0,
            promptCount: Number(result.metrics.promptCount) || 0,
            activePrompts: Number(result.metrics.activePrompts) || 0,
            inactivePrompts: Number(result.metrics.inactivePrompts) || 0,
            totalRuns: Number(result.metrics.totalRuns) || 0,
            recentRunsCount: Number(result.metrics.recentRunsCount) || 0
          }
        : {
            avgScore: 0,
            overallScore: 0,
            trend: 0,
            promptCount: 0,
            activePrompts: 0,
            inactivePrompts: 0,
            totalRuns: 0,
            recentRunsCount: 0
          },
      timestamp: result.timestamp || new Date().toISOString()
    };

    logger.info('RPC fetch completed successfully', {
      component: 'unified-rpc-fetcher',
      metadata: {
        fetchTimeMs: fetchTime,
        promptCount: safeResult.prompts.length,
        responseCount: safeResult.responses.length,
        chartDataPoints: safeResult.chartData.length
      }
    });

    return safeResult;

  } catch (error) {
    const fetchTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    logger.error('Unified RPC fetch failed', error as Error, { 
      component: 'unified-rpc-fetcher',
      metadata: { fetchTimeMs: fetchTime, errorMessage }
    });
    
    // Return safe error structure
    return {
      success: false,
      error: errorMessage,
      prompts: [],
      responses: [],
      chartData: [],
      metrics: {
        avgScore: 0,
        overallScore: 0,
        trend: 0,
        promptCount: 0,
        activePrompts: 0,
        inactivePrompts: 0,
        totalRuns: 0,
        recentRunsCount: 0
      },
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Real-time data fetcher with caching and refresh capabilities
 */
export class RealTimeDashboardFetcher {
  private cache: UnifiedDashboardResponse | null = null;
  private lastFetch: number = 0;
  private readonly CACHE_DURATION = 15000; // 15 seconds (reduced for better responsiveness)
  private refreshCallbacks: ((data: UnifiedDashboardResponse) => void)[] = [];
  private currentBrandId: string | null = null;

  /**
   * Set the current brand ID for filtering
   */
  setBrandId(brandId: string | null): void {
    if (this.currentBrandId !== brandId) {
      this.currentBrandId = brandId;
      this.clearCache(); // Clear cache when brand changes
    }
  }

  /**
   * Get dashboard data with caching
   */
  async getData(forceRefresh: boolean = false): Promise<UnifiedDashboardResponse> {
    const now = Date.now();
    
    // Return cached data if recent and not forcing refresh
    if (!forceRefresh && this.cache && this.cache.success && (now - this.lastFetch) < this.CACHE_DURATION) {
      logger.info('Returning cached dashboard data', { 
        component: 'unified-rpc-fetcher',
        metadata: {
          cacheAge: now - this.lastFetch,
          prompts: this.cache.prompts?.length || 0
        }
      });
      return this.cache;
    }

    // Fetch fresh data with brand filtering
    const data = await getUnifiedDashboardDataRPC(this.currentBrandId);
    
    // Only update cache if successful
    if (data.success) {
      this.cache = data;
      this.lastFetch = now;
    }

    // Notify subscribers only of successful data
    if (data.success) {
      this.refreshCallbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          logger.error('Refresh callback failed', error as Error, { 
            component: 'unified-rpc-fetcher' 
          });
        }
      });
    }

    return data;
  }

  /**
   * Subscribe to data refresh events
   */
  onRefresh(callback: (data: UnifiedDashboardResponse) => void): () => void {
    this.refreshCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.refreshCallbacks.indexOf(callback);
      if (index > -1) {
        this.refreshCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Force refresh data
   */
  async refresh(): Promise<UnifiedDashboardResponse> {
    return this.getData(true);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache = null;
    this.lastFetch = 0;
  }
}

// Global instance for reuse
export const dashboardFetcher = new RealTimeDashboardFetcher();
