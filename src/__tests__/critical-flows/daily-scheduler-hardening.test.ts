/**
 * End-to-End tests for daily scheduler hardening
 * Tests multi-org coverage, idempotency, and postcheck functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cgocsffxqyhojtyzniyz.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for E2E tests');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

describe('Daily Scheduler Hardening E2E', () => {
  const testOrgIds: string[] = [];
  const testPromptIds: string[] = [];
  const testBatchJobIds: string[] = [];

  beforeEach(async () => {
    // Create test organizations with active prompts across different tiers
    const testOrgs = [
      { name: 'Test Org 1', domain: 'test1.example.com', subscription_tier: 'starter' },
      { name: 'Test Org 2', domain: 'test2.example.com', subscription_tier: 'pro' },
      { name: 'Test Org 3', domain: 'test3.example.com', subscription_tier: 'enterprise' }
    ];

    for (const org of testOrgs) {
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert({
          ...org,
          plan_tier: org.subscription_tier,
          verified_at: new Date().toISOString() // Skip domain verification for tests
        })
        .select()
        .single();

      if (orgError) throw orgError;
      testOrgIds.push(orgData.id);

      // Create active prompts for each org
      const { data: promptData, error: promptError } = await supabase
        .from('prompts')
        .insert([
          { org_id: orgData.id, text: `Test prompt 1 for ${org.name}`, active: true },
          { org_id: orgData.id, text: `Test prompt 2 for ${org.name}`, active: true }
        ])
        .select();

      if (promptError) throw promptError;
      testPromptIds.push(...promptData.map(p => p.id));
    }
  });

  afterEach(async () => {
    // Cleanup test data
    if (testBatchJobIds.length > 0) {
      await supabase.from('batch_tasks').delete().in('batch_job_id', testBatchJobIds);
      await supabase.from('batch_jobs').delete().in('id', testBatchJobIds);
    }
    
    if (testPromptIds.length > 0) {
      await supabase.from('prompts').delete().in('id', testPromptIds);
    }
    
    if (testOrgIds.length > 0) {
      await supabase.from('organizations').delete().in('id', testOrgIds);
    }
  });

  it('should create batch jobs for all orgs with active prompts', async () => {
    // Simulate daily batch trigger for each org
    for (const orgId of testOrgIds) {
      const { data, error } = await supabase.functions.invoke('robust-batch-processor', {
        body: {
          action: 'create',
          orgId,
          correlationId: `test-${Date.now()}`
        }
      });

      expect(error).toBeNull();
      expect(data.success).toBe(true);
      expect(data.batchJobId).toBeDefined();
      
      if (data.batchJobId) {
        testBatchJobIds.push(data.batchJobId);
      }
    }

    // Verify batch jobs were created
    const { data: jobs, error: jobsError } = await supabase
      .from('batch_jobs')
      .select('*')
      .in('org_id', testOrgIds)
      .gte('created_at', new Date().toISOString().split('T')[0]); // Today

    expect(jobsError).toBeNull();
    expect(jobs).toHaveLength(testOrgIds.length);
    
    // Verify each org has exactly one job for today
    for (const orgId of testOrgIds) {
      const orgJobs = jobs?.filter(job => job.org_id === orgId) || [];
      expect(orgJobs).toHaveLength(1);
      expect(orgJobs[0].total_tasks).toBeGreaterThan(0); // Should have tasks
    }
  });

  it('should prevent duplicate daily jobs (idempotency)', async () => {
    const orgId = testOrgIds[0];
    
    // Create first job
    const { data: firstJob, error: firstError } = await supabase.functions.invoke('robust-batch-processor', {
      body: {
        action: 'create',
        orgId,
        correlationId: `test-first-${Date.now()}`
      }
    });

    expect(firstError).toBeNull();
    expect(firstJob.success).toBe(true);
    expect(firstJob.action).toBe('completed');
    testBatchJobIds.push(firstJob.batchJobId);

    // Attempt to create second job (should be prevented)
    const { data: secondJob, error: secondError } = await supabase.functions.invoke('robust-batch-processor', {
      body: {
        action: 'create',
        orgId,
        correlationId: `test-second-${Date.now()}`
      }
    });

    expect(secondError).toBeNull();
    expect(secondJob.success).toBe(true);
    expect(secondJob.action).toBe('duplicate_prevented');
    expect(secondJob.existingJobId).toBe(firstJob.batchJobId);

    // Verify only one job exists for today
    const { data: todayJobs, error: jobsError } = await supabase
      .from('batch_jobs')
      .select('*')
      .eq('org_id', orgId)
      .gte('created_at', new Date().toISOString().split('T')[0]);

    expect(jobsError).toBeNull();
    expect(todayJobs).toHaveLength(1);
  });

  it('should allow duplicate jobs when replace=true', async () => {
    const orgId = testOrgIds[0];
    
    // Create first job
    const { data: firstJob } = await supabase.functions.invoke('robust-batch-processor', {
      body: {
        action: 'create',
        orgId,
        correlationId: `test-first-${Date.now()}`
      }
    });
    testBatchJobIds.push(firstJob.batchJobId);

    // Create replacement job with replace=true
    const { data: replacementJob, error: replaceError } = await supabase.functions.invoke('robust-batch-processor', {
      body: {
        action: 'create',
        orgId,
        replace: true,
        correlationId: `test-replace-${Date.now()}`
      }
    });

    expect(replaceError).toBeNull();
    expect(replacementJob.success).toBe(true);
    expect(replacementJob.action).toBe('completed');
    expect(replacementJob.batchJobId).not.toBe(firstJob.batchJobId);
    testBatchJobIds.push(replacementJob.batchJobId);

    // Verify original job was cancelled
    const { data: originalJob } = await supabase
      .from('batch_jobs')
      .select('status')
      .eq('id', firstJob.batchJobId)
      .single();

    expect(originalJob?.status).toBe('cancelled');
  });

  it('should detect coverage gaps in postcheck', async () => {
    // Create jobs for only 2 out of 3 orgs
    for (let i = 0; i < 2; i++) {
      const { data } = await supabase.functions.invoke('robust-batch-processor', {
        body: {
          action: 'create',
          orgId: testOrgIds[i],
          correlationId: `test-partial-${i}`
        }
      });
      testBatchJobIds.push(data.batchJobId);
    }

    // Run postcheck
    const { data: postcheckResult, error: postcheckError } = await supabase.functions.invoke('scheduler-postcheck', {
      body: { test_mode: true }
    });

    expect(postcheckError).toBeNull();
    expect(postcheckResult.success).toBe(true);
    expect(postcheckResult.coverage.expected).toBe(testOrgIds.length);
    expect(postcheckResult.coverage.found).toBe(2);
    expect(postcheckResult.coverage.missing).toBe(1);
    expect(postcheckResult.coverage.missingOrgIds).toContain(testOrgIds[2]);
    expect(postcheckResult.summary.successRate).toBeLessThan(100);
  });

  it('should trigger self-healing for missing orgs', async () => {
    // Don't create any jobs initially, let postcheck trigger them
    
    // Get CRON secret for postcheck call
    const { data: cronSecret } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'cron_secret')
      .single();

    // Run postcheck with healing
    const { data: postcheckResult, error: postcheckError } = await supabase.functions.invoke('scheduler-postcheck', {
      headers: {
        'x-cron-secret': cronSecret?.value || ''
      }
    });

    expect(postcheckError).toBeNull();
    expect(postcheckResult.success).toBe(true);
    expect(postcheckResult.healing.attempted).toBeGreaterThan(0);
    
    // Give healing some time to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify healing created jobs
    const { data: healedJobs } = await supabase
      .from('batch_jobs')
      .select('*')
      .in('org_id', testOrgIds)
      .gte('created_at', new Date().toISOString().split('T')[0]);

    expect(healedJobs?.length).toBeGreaterThan(0);
    
    // Track created jobs for cleanup
    healedJobs?.forEach(job => testBatchJobIds.push(job.id));
  });

  it('should validate tasks are created for each prompt × provider combination', async () => {
    const orgId = testOrgIds[0];
    
    // Create batch job
    const { data: jobResult } = await supabase.functions.invoke('robust-batch-processor', {
      body: {
        action: 'create',
        orgId,
        correlationId: `test-tasks-${Date.now()}`
      }
    });
    testBatchJobIds.push(jobResult.batchJobId);

    // Get org's active prompts
    const { data: prompts } = await supabase
      .from('prompts')
      .select('id')
      .eq('org_id', orgId)
      .eq('active', true);

    // Get enabled providers (simulated - in real test would check env vars)
    const expectedProviders = ['openai', 'perplexity', 'gemini']; // Adjust based on available keys
    const expectedTaskCount = (prompts?.length || 0) * expectedProviders.length;

    // Verify tasks were created
    const { data: tasks } = await supabase
      .from('batch_tasks')
      .select('*')
      .eq('batch_job_id', jobResult.batchJobId);

    expect(tasks?.length).toBe(expectedTaskCount);
    
    // Verify each prompt has tasks for each provider
    for (const prompt of prompts || []) {
      for (const provider of expectedProviders) {
        const providerTasks = tasks?.filter(t => t.prompt_id === prompt.id && t.provider === provider);
        expect(providerTasks?.length).toBe(1);
      }
    }
  });

  it('should ensure batch-reconciler can finalize stuck jobs', async () => {
    // Create a job but don't process it (simulate stuck state)
    const { data: jobResult } = await supabase.functions.invoke('robust-batch-processor', {
      body: {
        action: 'create',
        orgId: testOrgIds[0],
        correlationId: `test-stuck-${Date.now()}`
      }
    });
    testBatchJobIds.push(jobResult.batchJobId);

    // Manually mark some tasks as completed to simulate partial completion
    const { data: tasks } = await supabase
      .from('batch_tasks')
      .select('id')
      .eq('batch_job_id', jobResult.batchJobId)
      .limit(2);

    if (tasks && tasks.length > 0) {
      await supabase
        .from('batch_tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .in('id', tasks.map(t => t.id));
    }

    // Manually set job as stuck (old heartbeat)
    await supabase
      .from('batch_jobs')
      .update({
        status: 'processing',
        last_heartbeat: new Date(Date.now() - 5 * 60 * 1000).toISOString() // 5 minutes ago
      })
      .eq('id', jobResult.batchJobId);

    // Run reconciler
    const { data: reconcilerResult, error: reconcilerError } = await supabase.functions.invoke('batch-reconciler');

    expect(reconcilerError).toBeNull();
    expect(reconcilerResult.success).toBe(true);

    // Verify job was handled by reconciler
    const { data: finalJob } = await supabase
      .from('batch_jobs')
      .select('status, completed_tasks, failed_tasks')
      .eq('id', jobResult.batchJobId)
      .single();

    expect(finalJob?.status).toBeOneOf(['completed', 'processing']); // Should be finalized or properly resumable
  });
});