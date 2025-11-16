import { useQuery } from '@tanstack/react-query';
import { fetchCompetitorsV2, CompetitorFilters, CompetitorSummaryRow } from './api';

/**
 * React Query hook for fetching competitor data with caching
 * Provides loading states, error handling, and automatic refetch management
 */
/**
 * React Query hook for fetching competitor data with caching
 * Defaults to 30 days of rolling history
 */
export function useCompetitors(filters: CompetitorFilters = {}) {
  // Ensure 30-day default for rolling history
  const filtersWithDefaults = {
    days: 30,
    ...filters
  };
  
  return useQuery<CompetitorSummaryRow[]>({
    queryKey: ['competitors_v2', filtersWithDefaults],
    queryFn: () => fetchCompetitorsV2(filtersWithDefaults),
    staleTime: 60_000, // 1 minute cache
    refetchOnWindowFocus: false,
    retry: 1
  });
}
