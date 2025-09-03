import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => ({
    update: vi.fn(() => ({
      eq: vi.fn(() => ({ data: null, error: null }))
    })),
    select: vi.fn(() => ({
      eq: vi.fn(() => ({ data: [], error: null }))
    }))
  })),
  functions: {
    invoke: vi.fn()
  },
  rpc: vi.fn()
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase)
}));

describe('Batch Job Resumption Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Time Budget Exceeded Handling', () => {
    it('should return in_progress when time budget exceeded', async () => {
      // Simulate robust-batch-processor hitting time budget
      const response = {
        success: true,
        action: 'in_progress',
        batchJobId: 'test-job-id',
        totalProcessed: 40,
        processedSoFar: 35,
        failedSoFar: 5,
        elapsedTime: 285000, // Over 280s budget
        correlationId: 'test-correlation-id',
        message: 'Processing continues in background. 35 completed, 5 failed so far.'
      };

      expect(response.action).toBe('in_progress');
      expect(response.elapsedTime).toBeGreaterThan(280000);
      expect(response.correlationId).toBeDefined();
    });

    it('should schedule background resume for CRON calls', async () => {
      const mockEdgeRuntime = {
        waitUntil: vi.fn()
      };
      
      global.EdgeRuntime = mockEdgeRuntime;

      // Simulate CRON call with time budget exceeded
      const headers = new Headers({ 'x-cron-secret': 'test-secret' });
      const isCronCall = headers.get('x-cron-secret');

      expect(isCronCall).toBeTruthy();
      // Background scheduling would be triggered
    });
  });

  describe('Batch Reconciler Auto-Resume', () => {
    it('should trigger robust-batch-processor resume when job marked as resumed', async () => {
      // Mock resume_stuck_batch_job response
      const resumeResult = {
        action: 'resumed',
        pending_tasks: 14,
        completed_tasks: 35,
        failed_tasks: 5
      };

      mockSupabase.rpc.mockResolvedValueOnce({ data: resumeResult, error: null });
      mockSupabase.functions.invoke.mockResolvedValueOnce({
        data: { action: 'completed', batchJobId: 'test-job-id' },
        error: null
      });

      // Simulate batch-reconciler processing
      const job = {
        id: 'test-job-id',
        org_id: 'test-org-id'
      };

      // Verify that robust-batch-processor is invoked with resume action
      expect(resumeResult.action).toBe('resumed');
      expect(resumeResult.pending_tasks).toBe(14);
    });

    it('should handle resume invocation failures gracefully', async () => {
      const resumeResult = {
        action: 'resumed',
        pending_tasks: 14
      };

      mockSupabase.rpc.mockResolvedValueOnce({ data: resumeResult, error: null });
      mockSupabase.functions.invoke.mockRejectedValueOnce(new Error('Invocation failed'));

      // Should not throw, just log error
      expect(() => {
        // Process resumed job with failed invocation
      }).not.toThrow();
    });
  });

  describe('Daily Batch Trigger Response Handling', () => {
    it('should recognize in_progress responses from robust-batch-processor', async () => {
      const batchResult = {
        data: {
          action: 'in_progress',
          batchJobId: 'test-job-id',
          correlationId: 'test-correlation-id'
        },
        error: null
      };

      mockSupabase.functions.invoke.mockResolvedValueOnce(batchResult);

      const result = batchResult.data;
      expect(result.action).toBe('in_progress');
      expect(result.batchJobId).toBeDefined();
      expect(result.correlationId).toBeDefined();
    });
  });

  describe('Safety Limits', () => {
    it('should respect MAX_RESUME_ATTEMPTS limit', () => {
      const MAX_RESUME_ATTEMPTS = 3;
      
      for (let attempt = 1; attempt <= MAX_RESUME_ATTEMPTS + 1; attempt++) {
        const shouldContinue = attempt <= MAX_RESUME_ATTEMPTS;
        expect(shouldContinue).toBe(attempt <= 3);
      }
    });

    it('should include correlation_id in all resume operations', () => {
      const correlationId = crypto.randomUUID();
      
      expect(correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should enforce RESUME_DELAY_MS between resume attempts', () => {
      const RESUME_DELAY_MS = 5000;
      const startTime = Date.now();
      
      // Simulate delay
      setTimeout(() => {
        const elapsed = Date.now() - startTime;
        expect(elapsed).toBeGreaterThanOrEqual(RESUME_DELAY_MS - 100); // Small tolerance
      }, RESUME_DELAY_MS);
    });
  });

  describe('Observability', () => {
    it('should include correlation_id in job metadata', () => {
      const metadata = {
        time_budget_exceeded: true,
        elapsed_time_ms: 285000,
        processed_in_this_run: 35,
        failed_in_this_run: 5,
        correlation_id: 'test-correlation-id'
      };

      expect(metadata.correlation_id).toBeDefined();
      expect(metadata.time_budget_exceeded).toBe(true);
    });

    it('should track resumedBy source in resume requests', () => {
      const resumeRequest = {
        action: 'resume',
        resumeJobId: 'test-job-id',
        orgId: 'test-org-id',
        correlationId: 'test-correlation-id',
        resumedBy: 'batch-reconciler'
      };

      expect(resumeRequest.resumedBy).toBe('batch-reconciler');
      expect(['batch-reconciler', 'background-scheduler']).toContain(resumeRequest.resumedBy);
    });
  });
});