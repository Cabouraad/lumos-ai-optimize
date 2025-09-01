/**
 * Real-time dashboard hook with optimized fetching and auto-refresh
 */

import { useState, useEffect, useCallback } from 'react';
import { dashboardFetcher, UnifiedDashboardResponse } from '@/lib/data/unified-rpc-fetcher';
import { useToast } from '@/hooks/use-toast';

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

  // Fetch data function
  const fetchData = useCallback(async (forceRefresh: boolean = false) => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await dashboardFetcher.getData(forceRefresh);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch dashboard data');
      }
      
      setData(result);
      setLastUpdated(new Date());
      
    } catch (err) {
      const error = err as Error;
      console.error('Dashboard fetch error:', error);
      setError(error);
      
      if (onError) {
        onError(error);
      } else {
        toast({
          title: 'Dashboard Error',
          description: 'Failed to load dashboard data. Please try again.',
          variant: 'destructive'
        });
      }
    } finally {
      setLoading(false);
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
      return;
    }

    const interval = setInterval(() => {
      // Only auto-refresh if not currently loading
      if (!loading) {
        fetchData(false);
      }
    }, autoRefreshInterval);

    return () => clearInterval(interval);
  }, [enableAutoRefresh, autoRefreshInterval, loading, fetchData]);

  // Subscribe to real-time updates
  useEffect(() => {
    const unsubscribe = dashboardFetcher.onRefresh((newData) => {
      if (newData.success) {
        setData(newData);
        setLastUpdated(new Date());
        setError(null);
      }
    });

    return unsubscribe;
  }, []);

  // Handle visibility change (refresh when tab becomes visible)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !loading) {
        fetchData(false);
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
    autoRefreshInterval: 30000, // 30 seconds for prompt data
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