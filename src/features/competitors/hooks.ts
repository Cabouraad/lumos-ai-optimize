import { useQuery } from '@tanstack/react-query';
import { fetchCompetitorsV2, CompetitorFilters, CompetitorSummaryRow } from './api';

/**
 * React Query hook for fetching competitor data with caching
 * Provides loading states, error handling, and automatic refetch management
 */
export function useCompetitors(filters: CompetitorFilters) {
  return useQuery<CompetitorSummaryRow[]>({
    queryKey: ['competitors_v2', filters],
    queryFn: () => fetchCompetitorsV2(filters),
    staleTime: 60_000, // 1 minute cache
    refetchOnWindowFocus: false,
    retry: 1
  });
}
