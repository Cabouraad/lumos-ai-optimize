import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { getBulkPromptData, groupResponsesByPrompt, groupStatsByPrompt, getBulkCompetitorData } from '../bulk-fetcher';

// Mock feature flags
const mockFeatureFlags = {
  FEATURE_BULK_QUERIES: true
};

vi.mock('@/config/featureFlags', () => ({
  isOptimizationFeatureEnabled: vi.fn((flag: string) => mockFeatureFlags[flag as keyof typeof mockFeatureFlags]),
  logFeatureFlagUsage: vi.fn()
}));

// Mock auth
vi.mock('@/lib/auth', () => ({
  getOrgId: vi.fn().mockResolvedValue('test-org-id')
}));

// Mock supabase
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn().mockResolvedValue({ 
          data: [
            { id: 'prompt-1', text: 'Test prompt', active: true, created_at: '2024-01-01', org_id: 'test-org-id' }
          ], 
          error: null 
        }))
      }))
    })),
    in: vi.fn(() => ({
      eq: vi.fn(() => ({
        gte: vi.fn().mockResolvedValue({
          data: [
            { prompt_id: 'prompt-1', competitors_json: ['competitor1', 'competitor2'] }
          ],
          error: null
        })
      }))
    }))
  })),
  rpc: vi.fn().mockResolvedValue({ 
    data: [
      { id: 'response-1', prompt_id: 'prompt-1', provider: 'openai', score: 7.5 }
    ], 
    error: null 
  })
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase
}));

describe('Bulk Query Optimization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFeatureFlags.FEATURE_BULK_QUERIES = true;
  });

  describe('getBulkPromptData', () => {
    it('should fetch all data in parallel queries when feature enabled', async () => {
      const result = await getBulkPromptData();
      
      expect(result).toHaveProperty('prompts');
      expect(result).toHaveProperty('latestResponses');
      expect(result).toHaveProperty('sevenDayStats');
      
      // Verify parallel execution (all 3 queries called)
      expect(mockSupabase.from).toHaveBeenCalledWith('prompts');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_latest_prompt_provider_responses_catalog_only', expect.any(Object));
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_prompt_visibility_7d', expect.any(Object));
    });

    it('should throw error when feature flag disabled', async () => {
      mockFeatureFlags.FEATURE_BULK_QUERIES = false;
      
      await expect(getBulkPromptData()).rejects.toThrow('Bulk queries not enabled');
    });

    it('should handle query errors gracefully', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: null, error: new Error('DB error') })
          })
        })
      });

      await expect(getBulkPromptData()).rejects.toThrow('DB error');
    });
  });

  describe('groupResponsesByPrompt', () => {
    it('should group responses by prompt_id for O(1) lookup', () => {
      const responses = [
        { prompt_id: 'prompt-1', provider: 'openai', score: 7.5 },
        { prompt_id: 'prompt-1', provider: 'gemini', score: 6.8 },
        { prompt_id: 'prompt-2', provider: 'openai', score: 8.2 }
      ];

      const grouped = groupResponsesByPrompt(responses);

      expect(grouped.get('prompt-1')).toHaveLength(2);
      expect(grouped.get('prompt-2')).toHaveLength(1);
      expect(grouped.get('prompt-1')?.[0].provider).toBe('openai');
      expect(grouped.get('prompt-1')?.[1].provider).toBe('gemini');
    });

    it('should handle empty responses array', () => {
      const grouped = groupResponsesByPrompt([]);
      expect(grouped.size).toBe(0);
    });
  });

  describe('groupStatsByPrompt', () => {
    it('should group stats by prompt_id for O(1) lookup', () => {
      const stats = [
        { prompt_id: 'prompt-1', runs_7d: 25, avg_score_7d: 7.2 },
        { prompt_id: 'prompt-2', runs_7d: 15, avg_score_7d: 6.8 }
      ];

      const grouped = groupStatsByPrompt(stats);

      expect(grouped.get('prompt-1')?.runs_7d).toBe(25);
      expect(grouped.get('prompt-2')?.avg_score_7d).toBe(6.8);
    });
  });

  describe('getBulkCompetitorData', () => {
    it('should fetch competitor data for multiple prompts in one query', async () => {
      const promptIds = ['prompt-1', 'prompt-2'];
      
      const result = await getBulkCompetitorData(promptIds);
      
      expect(mockSupabase.from).toHaveBeenCalledWith('prompt_provider_responses');
      expect(result.has('prompt-1')).toBe(true);
    });

    it('should return empty map for empty prompt IDs', async () => {
      const result = await getBulkCompetitorData([]);
      expect(result.size).toBe(0);
    });

    it('should throw error when feature flag disabled', async () => {
      mockFeatureFlags.FEATURE_BULK_QUERIES = false;
      
      await expect(getBulkCompetitorData(['prompt-1'])).rejects.toThrow('Bulk queries not enabled');
    });
  });

  describe('Performance characteristics', () => {
    it('should reduce database calls from N+1 to constant', async () => {
      const callCountBefore = mockSupabase.from.mock.calls.length + mockSupabase.rpc.mock.calls.length;
      
      await getBulkPromptData();
      
      const callCountAfter = mockSupabase.from.mock.calls.length + mockSupabase.rpc.mock.calls.length;
      const totalCalls = callCountAfter - callCountBefore;
      
      // Should be exactly 3 calls regardless of number of prompts
      expect(totalCalls).toBe(3);
    });

    it('should provide O(1) lookup performance for grouped data', () => {
      const responses = Array.from({ length: 1000 }, (_, i) => ({
        prompt_id: `prompt-${i % 10}`,
        provider: 'openai',
        score: 7.5
      }));

      const startTime = performance.now();
      const grouped = groupResponsesByPrompt(responses);
      const groupTime = performance.now() - startTime;

      // Multiple lookups should be very fast
      const lookupStart = performance.now();
      for (let i = 0; i < 100; i++) {
        grouped.get(`prompt-${i % 10}`);
      }
      const lookupTime = performance.now() - lookupStart;

      expect(lookupTime).toBeLessThan(groupTime); // Lookups faster than initial grouping
      expect(lookupTime).toBeLessThan(10); // Should be under 10ms for 100 lookups
    });
  });
});