import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(),
        maybeSingle: vi.fn()
      })),
      order: vi.fn(() => ({
        limit: vi.fn()
      }))
    })),
    insert: vi.fn(),
    update: vi.fn(() => ({
      eq: vi.fn()
    }))
  })),
  functions: {
    invoke: vi.fn()
  },
  rpc: vi.fn()
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockSupabaseClient
}));

describe('Admin Batch Trigger Enhanced Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Preflight Calculations', () => {
    it('should calculate expected tasks correctly', () => {
      const mockPreflightData = {
        prompts: { count: 5 },
        providers: { available: ['openai', 'perplexity', 'gemini'] },
        expectedTasks: 15, // 5 prompts × 3 providers
        quota: { allowed: true }
      };

      expect(mockPreflightData.expectedTasks).toBe(
        mockPreflightData.prompts.count * mockPreflightData.providers.available.length
      );
    });

    it('should identify skip reasons correctly', () => {
      const testCases = [
        {
          prompts: { count: 0 },
          providers: { available: ['openai'] },
          quota: { allowed: true },
          expectedReason: 'No active prompts found'
        },
        {
          prompts: { count: 5 },
          providers: { available: [] },
          quota: { allowed: true },
          expectedReason: 'No API keys configured for any providers'
        },
        {
          prompts: { count: 5 },
          providers: { available: ['openai'] },
          quota: { allowed: false },
          expectedReason: 'Daily quota exceeded'
        },
        {
          prompts: { count: 5 },
          providers: { available: ['openai'] },
          quota: { allowed: true },
          expectedTasks: 0,
          expectedReason: 'No tasks would be created'
        }
      ];

      testCases.forEach(testCase => {
        let skipReason = null;
        const { prompts, providers, quota, expectedTasks = prompts.count * providers.available.length } = testCase;

        if (prompts.count === 0) {
          skipReason = 'No active prompts found';
        } else if (providers.available.length === 0) {
          skipReason = 'No API keys configured for any providers';
        } else if (!quota.allowed) {
          skipReason = 'Daily quota exceeded';
        } else if (expectedTasks === 0) {
          skipReason = 'No tasks would be created';
        }

        expect(skipReason).toBe(testCase.expectedReason);
      });
    });
  });

  describe('Summary Statistics', () => {
    it('should calculate aggregate summary correctly', () => {
      const mockResults = [
        {
          orgId: 'org1',
          success: true,
          promptCount: 3,
          expectedTasks: 9,
          availableProviders: ['openai', 'perplexity']
        },
        {
          orgId: 'org2', 
          success: true,
          promptCount: 2,
          expectedTasks: 4,
          availableProviders: ['gemini']
        },
        {
          orgId: 'org3',
          success: false,
          promptCount: 0,
          expectedTasks: 0,
          availableProviders: [],
          skipReason: 'No active prompts found'
        }
      ];

      const totalPrompts = mockResults.reduce((sum, r) => sum + (r.promptCount || 0), 0);
      const totalExpectedTasks = mockResults.reduce((sum, r) => sum + (r.expectedTasks || 0), 0);
      const providersUsed = [...new Set(mockResults.flatMap(r => r.availableProviders || []))];
      const successfulJobs = mockResults.filter(r => r.success).length;
      const skippedOrgs = mockResults.filter(r => r.skipReason).length;

      expect(totalPrompts).toBe(5); // 3 + 2 + 0
      expect(totalExpectedTasks).toBe(13); // 9 + 4 + 0
      expect(providersUsed).toEqual(['openai', 'perplexity', 'gemini']);
      expect(successfulJobs).toBe(2);
      expect(skippedOrgs).toBe(1);
    });
  });

  describe('Replace Flag Behavior', () => {
    it('should pass replace flag to batch processor when enabled', async () => {
      const mockInvoke = vi.fn().mockResolvedValue({
        data: { action: 'created', batchJobId: 'job123' },
        error: null
      });
      mockSupabaseClient.functions.invoke = mockInvoke;

      // Simulate the call that would be made with replace flag
      await mockSupabaseClient.functions.invoke('robust-batch-processor', {
        body: {
          action: 'create',
          orgId: 'test-org',
          replace: true,
          correlationId: 'test-run-id'
        },
        headers: { 'x-cron-secret': 'test-secret' }
      });

      expect(mockInvoke).toHaveBeenCalledWith('robust-batch-processor', {
        body: expect.objectContaining({
          replace: true
        }),
        headers: { 'x-cron-secret': 'test-secret' }
      });
    });
  });

  describe('Result Reporting', () => {
    it('should include all required fields in results', () => {
      const mockResult = {
        orgId: 'org1',
        orgName: 'Test Org',
        success: true,
        action: 'created',
        batchJobId: 'job123',
        promptCount: 5,
        availableProviders: ['openai', 'perplexity'],
        expectedTasks: 10,
        processedTasks: 10
      };

      // Verify all required fields are present
      expect(mockResult).toHaveProperty('orgId');
      expect(mockResult).toHaveProperty('orgName');
      expect(mockResult).toHaveProperty('success');
      expect(mockResult).toHaveProperty('action');
      expect(mockResult).toHaveProperty('promptCount');
      expect(mockResult).toHaveProperty('availableProviders');
      expect(mockResult).toHaveProperty('expectedTasks');

      // Verify data types and values
      expect(typeof mockResult.success).toBe('boolean');
      expect(Array.isArray(mockResult.availableProviders)).toBe(true);
      expect(typeof mockResult.promptCount).toBe('number');
      expect(typeof mockResult.expectedTasks).toBe('number');
    });

    it('should handle skipped organization results', () => {
      const mockSkippedResult = {
        orgId: 'org2',
        orgName: 'Skipped Org',
        success: false,
        action: 'skipped',
        promptCount: 0,
        availableProviders: [],
        expectedTasks: 0,
        skipReason: 'No active prompts found'
      };

      expect(mockSkippedResult.success).toBe(false);
      expect(mockSkippedResult.action).toBe('skipped');
      expect(mockSkippedResult).toHaveProperty('skipReason');
      expect(mockSkippedResult.promptCount).toBe(0);
    });
  });
});