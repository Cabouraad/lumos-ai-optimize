import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  generateContentStudioItem, 
  listContentStudioItems, 
  getContentStudioItem,
  updateContentStudioItemStatus 
} from './api';
import type { GenerateContentStudioRequest, ContentStudioItem } from './types';

/**
 * Hook to generate a Content Studio item
 */
export function useGenerateContentStudioItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: GenerateContentStudioRequest) => generateContentStudioItem(request),
    onSuccess: (result) => {
      if (result.success && result.item) {
        toast.success('Content blueprint generated!');
        queryClient.invalidateQueries({ queryKey: ['content-studio-items'] });
      } else if (result.upgradeRequired) {
        toast.error('Upgrade required', {
          description: 'Content Studio is available on Growth & Pro plans.',
        });
      } else if (result.error) {
        toast.error('Generation failed', { description: result.error });
      }
    },
    onError: (error: Error) => {
      toast.error('Failed to generate content blueprint', { description: error.message });
    },
  });
}

/**
 * Hook to list Content Studio items for the organization
 */
export function useContentStudioItems(limit = 20) {
  return useQuery({
    queryKey: ['content-studio-items', limit],
    queryFn: () => listContentStudioItems(limit),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch a single Content Studio item
 */
export function useContentStudioItem(id: string | null) {
  return useQuery({
    queryKey: ['content-studio-item', id],
    queryFn: () => (id ? getContentStudioItem(id) : null),
    enabled: !!id,
    staleTime: 60_000,
  });
}

/**
 * Hook to update Content Studio item status
 */
export function useUpdateContentStudioItemStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'draft' | 'in_progress' | 'completed' }) =>
      updateContentStudioItemStatus(id, status),
    onSuccess: () => {
      toast.success('Status updated');
      queryClient.invalidateQueries({ queryKey: ['content-studio-items'] });
    },
    onError: (error: Error) => {
      toast.error('Failed to update status', { description: error.message });
    },
  });
}

/**
 * Helper to check if user's tier supports Content Studio
 */
export function canUseContentStudio(tier: string | null | undefined): boolean {
  if (!tier) return false;
  const allowedTiers = ['growth', 'pro', 'enterprise'];
  return allowedTiers.includes(tier.toLowerCase());
}
