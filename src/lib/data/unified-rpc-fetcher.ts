/**
 * Unified RPC-based data fetcher for optimal performance
 * Uses single database call instead of multiple queries
 */

import { supabase } from "@/integrations/supabase/client";
import { createUnifiedLogger } from '../observability/structured-logs';

const logger = createUnifiedLogger('unified-rpc-fetcher');

export interface UnifiedDashboardResponse {
  success: boolean;
  error?: string;
  prompts: any[];
  responses: any[];
  chartData: any[];
  metrics: {
    avgScore: number;
    overallScore: number;
    trend: number;
    promptCount: number;
    totalRuns: number;
    recentRunsCount: number;
  };
  timestamp: string;
}

/**
 * Fetch all dashboard data in a single optimized RPC call
 */
export async function getUnifiedDashboardDataRPC(): Promise<UnifiedDashboardResponse> {
  const startTime = Date.now();
  
  try {
    logger.info('Fetching unified dashboard data via RPC');
    
    const { data, error } = await supabase.rpc('get_unified_dashboard_data');
    
    const fetchTime = Date.now() - startTime;
    
    if (error) {
      logger.error('RPC fetch failed', error, { fetchTimeMs: fetchTime });
      throw error;
    }

    const result = data as any;
    
    if (!result?.success) {
      const errorMsg = result?.error || 'Unknown RPC error';
      logger.error('RPC returned error', new Error(errorMsg), { fetchTimeMs: fetchTime });
      throw new Error(errorMsg);
    }

    logger.info('RPC fetch completed successfully', {
      fetchTimeMs: fetchTime,
      promptCount: result.prompts?.length || 0,
      responseCount: result.responses?.length || 0,
      chartDataPoints: result.chartData?.length || 0
    });

    return {
      success: true,
      prompts: result.prompts || [],
      responses: result.responses || [],
      chartData: result.chartData || [],
      metrics: result.metrics || {
        avgScore: 0,
        overallScore: 0,
        trend: 0,
        promptCount: 0,
        totalRuns: 0,
        recentRunsCount: 0
      },
      timestamp: result.timestamp
    };

  } catch (error) {
    const fetchTime = Date.now() - startTime;
    logger.error('Unified RPC fetch failed', error as Error, { fetchTimeMs: fetchTime });
    
    // Return error structure
    return {
      success: false,
      error: (error as Error).message,
      prompts: [],
      responses: [],
      chartData: [],
      metrics: {
        avgScore: 0,
        overallScore: 0,
        trend: 0,
        promptCount: 0,
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
  private readonly CACHE_DURATION = 30000; // 30 seconds
  private refreshCallbacks: ((data: UnifiedDashboardResponse) => void)[] = [];

  /**
   * Get dashboard data with caching
   */
  async getData(forceRefresh: boolean = false): Promise<UnifiedDashboardResponse> {
    const now = Date.now();
    
    // Return cached data if recent and not forcing refresh
    if (!forceRefresh && this.cache && (now - this.lastFetch) < this.CACHE_DURATION) {
      logger.info('Returning cached dashboard data', { 
        cacheAge: now - this.lastFetch,
        prompts: this.cache.prompts?.length || 0
      });
      return this.cache;
    }

    // Fetch fresh data
    const data = await getUnifiedDashboardDataRPC();
    
    // Update cache
    this.cache = data;
    this.lastFetch = now;

    // Notify subscribers
    this.refreshCallbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        logger.error('Refresh callback failed', error as Error);
      }
    });

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