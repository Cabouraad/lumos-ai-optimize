
/**
 * Real-time dashboard hook with optimized fetching and auto-refresh
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { dashboardFetcher, UnifiedDashboardResponse } from '@/lib/data/unified-rpc-fetcher';
import { useToast } from '@/hooks/use-toast';
import { AdaptivePoller } from '@/lib/polling/adaptive-poller';

export interface UseRealTimeDashboardOptions {
  autoRefreshInterval?: number; // milliseconds (used as max interval)
  enableAutoRefresh?: boolean;
  onError?: (error: Error) => void;
  enableAdaptivePolling?: boolean;
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
    enableAdaptivePolling = true,
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
  const adaptivePollerRef = useRef<AdaptivePoller | null>(null);
  const pollerUnsubscribeRef = useRef<(() => void) | null>(null);

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

  // Auto-refresh interval with adaptive polling
  useEffect(() => {
    if (!enableAutoRefresh) {
      console.log('[Dashboard] Auto-refresh disabled');
      return;
    }

    if (enableAdaptivePolling) {
      // Use adaptive poller
      console.log('[Dashboard] Setting up adaptive polling');
      adaptivePollerRef.current = new AdaptivePoller({
        minInterval: 30000, // 30 seconds
        maxInterval: autoRefreshInterval,
        backoffMultiplier: 1.5,
        activityThreshold: 300000, // 5 minutes
        changeDetection: true
      });

      pollerUnsubscribeRef.current = adaptivePollerRef.current.subscribe(async () => {
        if (!fetchInProgressRef.current) {
          console.log('[Dashboard] Adaptive poll triggered');
          return fetchData(false);
        }
        console.log('[Dashboard] Adaptive poll skipped, already loading');
        return Promise.resolve();
      });

    } else {
      // Use traditional interval polling
      console.log('[Dashboard] Setting up traditional polling:', autoRefreshInterval);
      intervalRef.current = setInterval(() => {
        if (!fetchInProgressRef.current) {
          console.log('[Dashboard] Traditional poll triggered');
          fetchData(false);
        } else {
          console.log('[Dashboard] Traditional poll skipped, already loading');
        }
      }, autoRefreshInterval);
    }

    return () => {
      // Cleanup adaptive poller
      if (pollerUnsubscribeRef.current) {
        pollerUnsubscribeRef.current();
        pollerUnsubscribeRef.current = null;
      }
      if (adaptivePollerRef.current) {
        adaptivePollerRef.current.pause();
        adaptivePollerRef.current = null;
      }

      // Cleanup traditional interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      console.log('[Dashboard] Auto-refresh cleared');
    };
  }, [enableAutoRefresh, enableAdaptivePolling, autoRefreshInterval, fetchData]);

  // Subscribe to real-time updates (removed to prevent double updates)

  // Handle visibility change with throttling (disabled to prevent refresh-on-focus issues)
  useEffect(() => {
    // Disabled visibility refresh to prevent tab focus refreshes
    console.log('[Dashboard] Visibility refresh disabled - preventing focus refreshes');
    return;
  }, [enableAdaptivePolling]);

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
