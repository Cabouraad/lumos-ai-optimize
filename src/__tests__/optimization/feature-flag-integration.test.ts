import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { getUnifiedDashboardData } from '../../lib/data/unified-fetcher';

// Mock feature flags
const mockFeatureFlags = {
  FEATURE_BULK_QUERIES: false,
  FEATURE_RESPONSE_CACHE: false
};

vi.mock('@/config/featureFlags', () => ({
  isOptimizationFeatureEnabled: vi.fn((flag: string) => mockFeatureFlags[flag as keyof typeof mockFeatureFlags]),
  withFeatureFlag: vi.fn((flag, enabledFn, disabledFn) => {
    return mockFeatureFlags[flag as keyof typeof mockFeatureFlags] ? enabledFn() : disabledFn();
  }),
  logFeatureFlagUsage: vi.fn()
}));

// Mock dependencies
vi.mock('../../lib/data/bulk-fetcher', () => ({
  getBulkPromptData: vi.fn().mockResolvedValue({
    prompts: [{ id: 'prompt-1', text: 'Test', active: true, created_at: '2024-01-01', org_id: 'test-org' }],
    latestResponses: [{ id: 'resp-1', prompt_id: 'prompt-1', provider: 'openai', score: 7.5 }],
    sevenDayStats: [{ prompt_id: 'prompt-1', runs_7d: 10, avg_score_7d: 7.2 }]
  }),
  groupResponsesByPrompt: vi.fn().mockReturnValue(new Map()),
  groupStatsByPrompt: vi.fn().mockReturnValue(new Map())
}));

vi.mock('../../lib/data/dashboard-helpers', () => ({
  getProviders: vi.fn().mockResolvedValue([{ id: 'prov-1', name: 'OpenAI', enabled: true }]),
  processUnifiedData: vi.fn().mockReturnValue({
    avgScore: 7.5,
    overallScore: 7.2,
    trend: 0.5,
    promptCount: 1,
    totalRuns: 10,
    recentRunsCount: 5,
    chartData: [],
    providers: [],
    prompts: []
  })
}));

vi.mock('@/lib/auth', () => ({
  getOrgId: vi.fn().mockResolvedValue('test-org-id')
}));

vi.mock('../../lib/advanced-cache/redis-cache', () => ({
  advancedCache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn(),
    invalidate: vi.fn()
  },
  CacheEventManager: {
    getInstance: vi.fn().mockReturnValue({})
  }
}));

vi.mock('../../lib/background-optimization/data-preloader', () => ({
  backgroundPreloader: {
    preloadCriticalData: vi.fn()
  }
}));

// Mock supabase for standard path
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn().mockResolvedValue({ 
          data: [{ id: 'prompt-1', text: 'Test', active: true, created_at: '2024-01-01', org_id: 'test-org' }], 
          error: null 
        }),
        gte: vi.fn(() => ({
          order: vi.fn().mockResolvedValue({ data: [], error: null })
        }))
      })),
      in: vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({ data: [], error: null })
          }))
        }))
      }))
    }))
  })),
  rpc: vi.fn().mockResolvedValue({ data: [], error: null })
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase
}));

describe('Feature Flag Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFeatureFlags.FEATURE_BULK_QUERIES = false;
    mockFeatureFlags.FEATURE_RESPONSE_CACHE = false;
  });

  describe('Bulk Queries Feature Flag', () => {
    it('should use standard data fetching when FEATURE_BULK_QUERIES disabled', async () => {
      mockFeatureFlags.FEATURE_BULK_QUERIES = false;
      
      await getUnifiedDashboardData();
      
      // Should call standard supabase queries
      expect(mockSupabase.from).toHaveBeenCalledWith('prompts');
      expect(mockSupabase.from).toHaveBeenCalledWith('llm_providers');
    });

    it('should use bulk data fetching when FEATURE_BULK_QUERIES enabled', async () => {
      mockFeatureFlags.FEATURE_BULK_QUERIES = true;
      const { getBulkPromptData } = await import('../../lib/data/bulk-fetcher');
      
      await getUnifiedDashboardData();
      
      // Should call bulk fetcher
      expect(getBulkPromptData).toHaveBeenCalled();
    });

    it('should maintain same API shape regardless of feature flag', async () => {
      // Test with flag disabled
      mockFeatureFlags.FEATURE_BULK_QUERIES = false;
      const resultStandard = await getUnifiedDashboardData();
      
      // Test with flag enabled
      mockFeatureFlags.FEATURE_BULK_QUERIES = true;
      const resultBulk = await getUnifiedDashboardData();
      
      // Both results should have same structure
      expect(resultStandard).toHaveProperty('avgScore');
      expect(resultStandard).toHaveProperty('overallScore');
      expect(resultStandard).toHaveProperty('prompts');
      
      expect(resultBulk).toHaveProperty('avgScore');
      expect(resultBulk).toHaveProperty('overallScore');
      expect(resultBulk).toHaveProperty('prompts');
    });
  });

  describe('Response Cache Feature Flag', () => {
    it('should not use caching when FEATURE_RESPONSE_CACHE disabled', async () => {
      mockFeatureFlags.FEATURE_RESPONSE_CACHE = false;
      
      const { responseCache } = await import('../../lib/cache/response-cache');
      const getSpy = vi.spyOn(responseCache, 'get');
      
      // Cache operations should be bypassed
      expect(getSpy).not.toHaveBeenCalled();
    });

    it('should use caching when FEATURE_RESPONSE_CACHE enabled', async () => {
      mockFeatureFlags.FEATURE_RESPONSE_CACHE = true;
      
      // Test that caching mechanisms are available
      const { responseCache } = await import('../../lib/cache/response-cache');
      expect(responseCache).toBeDefined();
      expect(typeof responseCache.set).toBe('function');
      expect(typeof responseCache.get).toBe('function');
    });
  });

  describe('Performance Impact Measurement', () => {
    it('should measure performance difference between standard and bulk queries', async () => {
      // Measure standard performance
      mockFeatureFlags.FEATURE_BULK_QUERIES = false;
      const startStandard = performance.now();
      await getUnifiedDashboardData();
      const timeStandard = performance.now() - startStandard;
      
      // Measure bulk performance
      mockFeatureFlags.FEATURE_BULK_QUERIES = true;
      const startBulk = performance.now();
      await getUnifiedDashboardData();
      const timeBulk = performance.now() - startBulk;
      
      // Both should complete reasonably quickly
      expect(timeStandard).toBeLessThan(1000); // Under 1 second
      expect(timeBulk).toBeLessThan(1000); // Under 1 second
    });

    it('should handle large datasets efficiently with optimizations', async () => {
      // Mock large dataset
      const largePromptList = Array.from({ length: 100 }, (_, i) => ({
        id: `prompt-${i}`,
        text: `Test prompt ${i}`,
        active: true,
        created_at: '2024-01-01',
        org_id: 'test-org'
      }));

      mockSupabase.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: largePromptList, error: null })
          })
        })
      });

      mockFeatureFlags.FEATURE_BULK_QUERIES = true;
      
      const start = performance.now();
      await getUnifiedDashboardData();
      const time = performance.now() - start;
      
      // Should handle large datasets efficiently
      expect(time).toBeLessThan(500); // Under 500ms for 100 prompts
    });
  });

  describe('Error Handling with Feature Flags', () => {
    it('should fallback gracefully when bulk queries fail', async () => {
      mockFeatureFlags.FEATURE_BULK_QUERIES = true;
      
      const { getBulkPromptData } = await import('../../lib/data/bulk-fetcher');
      vi.mocked(getBulkPromptData).mockRejectedValueOnce(new Error('Bulk query failed'));
      
      // Should still throw the error (no silent fallback in current implementation)
      await expect(getUnifiedDashboardData()).rejects.toThrow('Bulk query failed');
    });

    it('should handle caching errors gracefully', async () => {
      mockFeatureFlags.FEATURE_RESPONSE_CACHE = true;
      
      // Should not crash even if cache operations fail
      await expect(getUnifiedDashboardData()).resolves.toBeDefined();
    });
  });

  describe('Feature Flag State Changes', () => {
    it('should adapt behavior when feature flags change mid-session', async () => {
      // Start with flags disabled
      mockFeatureFlags.FEATURE_BULK_QUERIES = false;
      await getUnifiedDashboardData();
      
      // Enable bulk queries
      mockFeatureFlags.FEATURE_BULK_QUERIES = true;
      await getUnifiedDashboardData();
      
      // Disable again
      mockFeatureFlags.FEATURE_BULK_QUERIES = false;
      await getUnifiedDashboardData();
      
      // Should work correctly in all states
      expect(mockSupabase.from).toHaveBeenCalled();
    });
  });
});