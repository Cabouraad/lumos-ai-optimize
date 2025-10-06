// NOTE: useGenerateVisibilityRecs has been removed in favor of useGenerateOptimizations from hooks-v2
// These tests are kept for reference but the hook no longer exists
// TODO: Create new tests for hooks-v2 if needed

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useVisibilityRecommendations, useAllVisibilityRecommendations } from '../hooks';
import * as api from '../api';
import { toast } from 'sonner';

vi.mock('../api');
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

vi.mock('@/lib/supabase/invoke', () => ({
  invokeEdge: vi.fn()
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Visibility Recommendations Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useVisibilityRecommendations', () => {
    it('should initialize with correct query key and function', () => {
      const mockRecs = [{ 
        id: '1', 
        title: 'Test Rec',
        channel: 'content',
        subtype: 'blog_post',
        org_id: 'org-1',
        prompt_id: 'prompt-123',
        outline: null,
        posting_instructions: '',
        must_include: {},
        where_to_publish: {},
        citations_used: [],
        success_metrics: [],
        score_before: 0,
        created_at: new Date().toISOString()
      }];
      vi.mocked(api.listVisibilityRecommendations).mockResolvedValue(mockRecs as any);

      const { result } = renderHook(() => useVisibilityRecommendations('prompt-123'), {
        wrapper: createWrapper()
      });

      expect(result.current.isLoading).toBeDefined();
      expect(api.listVisibilityRecommendations).toHaveBeenCalledWith('prompt-123');
    });
  });

  describe.skip('useGenerateVisibilityRecs (DEPRECATED - hook removed)', () => {
    it('should have mutate function', () => {
      // Hook removed - test skipped
      expect(true).toBe(true);
    });

    it('should call API when mutate is invoked', () => {
      // Hook removed - test skipped
      expect(true).toBe(true);
    });
  });

  describe('useAllVisibilityRecommendations', () => {
    it('should initialize query correctly', () => {
      const mockRecs = [
        { 
          id: '1',
          channel: 'content',
          subtype: 'blog_post',
          title: 'Rec 1',
          org_id: 'org-1',
          prompt_id: 'prompt-1',
          outline: null,
          posting_instructions: '',
          must_include: {},
          where_to_publish: {},
          citations_used: [],
          success_metrics: [],
          score_before: 0,
          created_at: new Date().toISOString(),
          prompts: { id: 'prompt-1', text: 'test prompt', org_id: 'org-1' }
        }
      ];
      vi.mocked(api.listAllOrgRecommendations).mockResolvedValue(mockRecs as any);

      const { result } = renderHook(() => useAllVisibilityRecommendations(), {
        wrapper: createWrapper()
      });

      expect(result.current.isLoading).toBeDefined();
      expect(api.listAllOrgRecommendations).toHaveBeenCalled();
    });
  });
});
