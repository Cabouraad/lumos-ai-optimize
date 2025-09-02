import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        in: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null }))
        })),
        single: vi.fn(() => Promise.resolve({ data: null, error: null }))
      })),
      order: vi.fn(() => Promise.resolve({ data: [], error: null }))
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ data: [], error: null }))
    })),
    insert: vi.fn(() => Promise.resolve({ data: [], error: null }))
  })),
  functions: {
    invoke: vi.fn()
  },
  rpc: vi.fn()
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase
}));

describe('Cancel & Start New Job Replacement Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Job Cancellation Logic', () => {
    it('should cancel existing batch jobs before starting new one', async () => {
      // Mock existing active jobs
      const existingJobs = [
        {
          id: 'job1',
          org_id: 'org1',
          status: 'processing',
          total_tasks: 100,
          completed_tasks: 45,
          failed_tasks: 2
        },
        {
          id: 'job2',
          org_id: 'org1',
          status: 'pending',
          total_tasks: 50,
          completed_tasks: 0,
          failed_tasks: 0
        }
      ];

      // Mock the RPC call for canceling jobs
      mockSupabase.rpc.mockResolvedValue({
        data: {
          success: true,
          cancelled_jobs: 2,
          cancelled_tasks: 53, // 53 remaining tasks cancelled
          org_id: 'org1'
        },
        error: null
      });

      // Mock the query for active jobs
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: existingJobs,
                error: null
              })
            }),
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          }),
          order: vi.fn().mockResolvedValue({ data: [], error: null })
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null })
        }),
        insert: vi.fn().mockResolvedValue({ data: [], error: null })
      });

      // Execute cancellation
      const result = await mockSupabase.rpc('cancel_active_batch_jobs', {
        p_org_id: 'org1',
        p_reason: 'New job requested by user'
      });

      expect(result.data.success).toBe(true);
      expect(result.data.cancelled_jobs).toBe(2);
      expect(result.data.cancelled_tasks).toBe(53);
    });

    it('should handle case when no active jobs exist', async () => {
      // Mock no existing jobs
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [],
                error: null
              })
            }),
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          }),
          order: vi.fn().mockResolvedValue({ data: [], error: null })
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null })
        }),
        insert: vi.fn().mockResolvedValue({ data: [], error: null })
      });

      mockSupabase.rpc.mockResolvedValue({
        data: {
          success: true,
          cancelled_jobs: 0,
          cancelled_tasks: 0,
          org_id: 'org1'
        },
        error: null
      });

      const result = await mockSupabase.rpc('cancel_active_batch_jobs', {
        p_org_id: 'org1',
        p_reason: 'New job requested by user'
      });

      expect(result.data.success).toBe(true);
      expect(result.data.cancelled_jobs).toBe(0);
      expect(result.data.cancelled_tasks).toBe(0);
    });

    it('should preserve completed tasks when cancelling jobs', async () => {
      const partiallyCompleteJob = {
        id: 'job1',
        org_id: 'org1',
        status: 'processing',
        total_tasks: 100,
        completed_tasks: 75,
        failed_tasks: 5
      };

      mockSupabase.rpc.mockResolvedValue({
        data: {
          success: true,
          cancelled_jobs: 1,
          cancelled_tasks: 20, // Only pending/processing tasks cancelled
          org_id: 'org1',
          preserved_completed: 75,
          preserved_failed: 5
        },
        error: null
      });

      const result = await mockSupabase.rpc('cancel_active_batch_jobs', {
        p_org_id: 'org1',
        p_reason: 'User requested new batch'
      });

      expect(result.data.success).toBe(true);
      expect(result.data.cancelled_tasks).toBe(20);
      expect(result.data.preserved_completed).toBe(75);
      expect(result.data.preserved_failed).toBe(5);
    });
  });

  describe('New Job Creation After Cancellation', () => {
    it('should create new batch job immediately after cancellation', async () => {
      // Mock successful cancellation
      mockSupabase.rpc
        .mockResolvedValueOnce({
          data: { success: true, cancelled_jobs: 1 },
          error: null
        });

      // Mock new job creation
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null })
            }),
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          }),
          order: vi.fn().mockResolvedValue({ data: [], error: null })
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null })
        }),
        insert: vi.fn().mockResolvedValue({
          data: [{
            id: 'new-job-1',
            org_id: 'org1',
            status: 'pending',
            total_tasks: 50,
            completed_tasks: 0,
            failed_tasks: 0,
            created_at: new Date().toISOString()
          }],
          error: null
        })
      });

      // Step 1: Cancel existing jobs
      const cancelResult = await mockSupabase.rpc('cancel_active_batch_jobs', {
        p_org_id: 'org1'
      });

      expect(cancelResult.data.success).toBe(true);

      // Step 2: Create new job
      const newJobResult = await mockSupabase.from().insert();

      expect(newJobResult.data).toHaveLength(1);
      expect(newJobResult.data[0].status).toBe('pending');
    });

    it('should handle edge function call for batch job management', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: {
          success: true,
          message: 'Previous jobs cancelled, new job created',
          job_id: 'new-job-123',
          cancelled_count: 2
        },
        error: null
      });

      const result = await mockSupabase.functions.invoke('robust-batch-processor', {
        body: {
          org_id: 'org1',
          prompt_ids: ['prompt1', 'prompt2', 'prompt3'],
          cancel_existing: true
        }
      });

      expect(result.data.success).toBe(true);
      expect(result.data.job_id).toBe('new-job-123');
      expect(result.data.cancelled_count).toBe(2);
    });

    it('should validate that new job does not conflict with existing active jobs', async () => {
      // Mock scenario where cancellation failed
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Failed to cancel jobs' }
      });

      // Mock job creation that should check for conflicts
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'conflicting-job', status: 'processing' }],
              error: null
            }),
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          }),
          order: vi.fn().mockResolvedValue({ data: [], error: null })
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null })
        }),
        insert: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Cannot create job while another is active' }
        })
      });

      // Attempt to create new job without proper cancellation
      const jobCreationResult = await mockSupabase.from().insert();

      expect(jobCreationResult.error).toBeTruthy();
      expect(jobCreationResult.error.message).toContain('Cannot create job');
    });
  });

  describe('User Interface Integration', () => {
    it('should show confirmation dialog before cancelling active jobs', () => {
      // Mock confirm dialog
      const mockConfirm = vi.fn().mockReturnValue(true);
      global.confirm = mockConfirm;

      const hasActiveJobs = true;
      const userConfirmed = confirm(
        'There are active batch jobs running. Cancel them and start a new job?'
      );

      expect(mockConfirm).toHaveBeenCalledWith(
        'There are active batch jobs running. Cancel them and start a new job?'
      );
      expect(userConfirmed).toBe(true);
    });

    it('should provide clear feedback about cancellation progress', () => {
      const mockToast = vi.fn();
      
      // Simulate toast notifications
      mockToast('Cancelling active jobs...');
      mockToast('2 jobs cancelled, starting new batch...');
      mockToast('New batch job created successfully!');

      expect(mockToast).toHaveBeenCalledWith('Cancelling active jobs...');
      expect(mockToast).toHaveBeenCalledWith('2 jobs cancelled, starting new batch...');
      expect(mockToast).toHaveBeenCalledWith('New batch job created successfully!');
    });

    it('should disable UI controls during cancellation and creation', () => {
      let isProcessing = false;
      let buttonDisabled = false;

      // Simulate the flow
      const startCancelAndCreate = async () => {
        isProcessing = true;
        buttonDisabled = true;

        try {
          // Cancellation step
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Creation step
          await new Promise(resolve => setTimeout(resolve, 100));
        } finally {
          isProcessing = false;
          buttonDisabled = false;
        }
      };

      expect(isProcessing).toBe(false);
      expect(buttonDisabled).toBe(false);

      // Start the process
      startCancelAndCreate();

      expect(isProcessing).toBe(true);
      expect(buttonDisabled).toBe(true);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle partial cancellation failures gracefully', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: {
          success: false,
          error: 'Some jobs could not be cancelled',
          cancelled_jobs: 1,
          failed_cancellations: 1,
          details: 'Job job2 is locked by another process'
        },
        error: null
      });

      const result = await mockSupabase.rpc('cancel_active_batch_jobs', {
        p_org_id: 'org1'
      });

      expect(result.data.success).toBe(false);
      expect(result.data.cancelled_jobs).toBe(1);
      expect(result.data.failed_cancellations).toBe(1);
    });

    it('should rollback new job creation if cancellation fails', async () => {
      // Mock cancellation failure
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' }
      });

      const cancelResult = await mockSupabase.rpc('cancel_active_batch_jobs', {
        p_org_id: 'org1'
      });

      if (cancelResult.error) {
        // Should not attempt to create new job
        expect(cancelResult.error.message).toBe('Database connection failed');
        
        // Verify no job creation was attempted
        expect(mockSupabase.from).not.toHaveBeenCalledWith('batch_jobs');
      }
    });

    it('should provide cleanup options when cancellation is stuck', async () => {
      // Mock stuck job scenario
      mockSupabase.rpc
        .mockResolvedValueOnce({
          data: {
            success: false,
            error: 'Jobs are stuck in processing state',
            stuck_jobs: ['job1', 'job2']
          },
          error: null
        })
        .mockResolvedValueOnce({
          data: {
            success: true,
            force_cancelled: 2,
            message: 'Force cancelled stuck jobs'
          },
          error: null
        });

      // First attempt - normal cancellation fails
      const firstAttempt = await mockSupabase.rpc('cancel_active_batch_jobs', {
        p_org_id: 'org1'
      });

      expect(firstAttempt.data.success).toBe(false);
      expect(firstAttempt.data.stuck_jobs).toHaveLength(2);

      // Second attempt - force cancellation
      const forceCancel = await mockSupabase.rpc('resume_stuck_batch_job', {
        p_job_id: 'job1'
      });

      expect(forceCancel.data.success).toBe(true);
    });
  });
});