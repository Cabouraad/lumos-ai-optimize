
/**
 * Real-time dashboard hook with optimized fetching and auto-refresh
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { dashboardFetcher, UnifiedDashboardResponse } from '@/lib/data/unified-rpc-fetcher';
import { useToast } from '@/components/ui/use-toast';

export interface UseRealTimeDashboardOptions {
  autoRefreshInterval?: number; // milliseconds
  enableAutoRefresh?: boolean;
  onError?: (error: Error) => void;
}

export interface UseRealTimeDashboardResult {
  data: UnifiedDashboardResponse | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  lastUpdated: Date | null;
}

export function useRealTimeDashboard(
  options: UseRealTimeDashboardOptions = {}
): UseRealTimeDashboardResult {
  const {
    autoRefreshInterval = 60000, // 1 minute default
    enableAutoRefresh = true,
    onError
  } = options;

  const [data, setData] = useState<UnifiedDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { toast } = useToast();
  
  // Refs to prevent excessive fetching
  const fetchInProgressRef = useRef(false);
  const lastVisibilityFetchRef = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  console.log('[Dashboard] Hook initialized:', { autoRefreshInterval, enableAutoRefresh });

  // Fetch data function
  const fetchData = useCallback(async (forceRefresh: boolean = false) => {
    // Prevent concurrent fetches
    if (fetchInProgressRef.current) {
      console.log('[Dashboard] Fetch already in progress, skipping');
      return;
    }
    
    fetchInProgressRef.current = true;
    console.log('[Dashboard] Starting fetch:', { forceRefresh });
    
    try {
      setLoading(true);
      setError(null);
      
      const result = await dashboardFetcher.getData(forceRefresh);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch dashboard data');
      }
      
      setData(result);
      setLastUpdated(new Date());
      console.log('[Dashboard] Fetch successful');
      
    } catch (err) {
      const error = err as Error;
      console.error('[Dashboard] Fetch error:', error);
      setError(error);
      
      if (onError) {
        onError(error);
      } else {
        toast({
          title: 'Dashboard Error',
          description: error.message || 'Failed to load dashboard data. Please try again.',
          variant: 'destructive'
        });
      }
    } finally {
      setLoading(false);
      fetchInProgressRef.current = false;
    }
  }, [onError, toast]);

  // Manual refresh function
  const refresh = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  // Initial data fetch
  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  // Auto-refresh interval
  useEffect(() => {
    if (!enableAutoRefresh || autoRefreshInterval <= 0) {
      console.log('[Dashboard] Auto-refresh disabled');
      return;
    }

    console.log('[Dashboard] Setting up auto-refresh:', autoRefreshInterval);
    intervalRef.current = setInterval(() => {
      // Only auto-refresh if not currently loading and no fetch in progress
      if (!loading && !fetchInProgressRef.current) {
        console.log('[Dashboard] Auto-refresh triggered');
        fetchData(false);
      } else {
        console.log('[Dashboard] Auto-refresh skipped, already loading');
      }
    }, autoRefreshInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        console.log('[Dashboard] Auto-refresh cleared');
      }
    };
  }, [enableAutoRefresh, autoRefreshInterval, fetchData]);

  // Subscribe to real-time updates (removed to prevent double updates)

  // Handle visibility change with throttling
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !loading && !fetchInProgressRef.current) {
        const now = Date.now();
        // Throttle to once every 5 seconds
        if (now - lastVisibilityFetchRef.current > 5000) {
          console.log('[Dashboard] Tab visible, refreshing');
          lastVisibilityFetchRef.current = now;
          fetchData(false);
        } else {
          console.log('[Dashboard] Tab visible but throttled');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loading, fetchData]);

  return {
    data,
    loading,
    error,
    refresh,
    lastUpdated
  };
}

/**
 * Hook for real-time prompt data with optimized updates
 */
export function useRealTimePrompts() {
  const { data, loading, error, refresh, lastUpdated } = useRealTimeDashboard({
    autoRefreshInterval: 120000, // 2 minutes for prompt data (slower)
    enableAutoRefresh: true
  });

  // Transform data for prompt components
  const prompts = data?.prompts || [];
  const responses = data?.responses || [];
  
  return {
    prompts,
    responses,
    loading,
    error,
    refresh,
    lastUpdated
  };
}
