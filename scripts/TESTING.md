# Batch Processor Testing Guide

This guide explains how to test the scheduler-triggered batch processor to ensure it completes all tasks without failure.

## Prerequisites

1. **Supabase Service Role Key**: Get from Supabase dashboard
2. **Cron Secret**: Either set as environment variable or it will be fetched from `app_settings` table

## Quick Test

Run the comprehensive scheduler test:

```bash
# Using environment variables
SUPABASE_SERVICE_ROLE_KEY="your_service_key" \
CRON_SECRET="your_cron_secret" \
node scripts/test-scheduler-batch.mjs --force
```

## Test Options

### Force Run
Forces the test to run even if the daily batch already ran today:
```bash
node scripts/test-scheduler-batch.mjs --force
```

### No Monitoring
Just triggers the batch without monitoring progress:
```bash
node scripts/test-scheduler-batch.mjs --no-monitor
```

### Custom Timeout
Set a custom monitoring timeout (in minutes):
```bash
node scripts/test-scheduler-batch.mjs --force --timeout=120
```

## What the Test Does

1. **Triggers** the `daily-batch-trigger` function (simulating the scheduler)
2. **Monitors** all created batch jobs in real-time
3. **Tracks** progress every 10 seconds with detailed status
4. **Verifies** 100% task completion across all organizations
5. **Reports** any failures or incomplete tasks

## Expected Output

### Successful Test
```
✅ SUCCESS: All tasks completed across all organizations

Example:
✅ Organization Name
   Status: completed
   Progress: 128/128 (100%)
   Completed: 125
   Failed: 3
   Remaining: 0
```

### Failed Test
```
❌ FAILURE: Some tasks remain incomplete

Example:
❌ Organization Name
   Status: processing
   Progress: 41/128 (32%)
   Completed: 35
   Failed: 6
   Remaining: 87
   ❌ INCOMPLETE: 87 tasks not processed
```

## Monitoring Details

The test shows real-time progress:

```
⏱️  Iteration 15 (elapsed: 150s)
────────────────────────────────────────────────────────────────────────────────
  ✅ Acme Corp                       | completed  | 100% | 128/128 completed, 0 failed, 0 remaining
  🔄 Beta Inc                        | processing |  45% | 50/112 completed, 0 failed, 62 remaining
     🔄 Driver active: 15 runs, last ping 3s ago
────────────────────────────────────────────────────────────────────────────────
  Summary: 1 completed, 1 processing, 0 failed
  Overall: 178/240 tasks (178 completed, 0 failed)
```

## Exit Codes

- `0`: All tasks completed successfully
- `1`: Test failed (incomplete tasks or errors)

## Troubleshooting

### No Batch Jobs Created

**Problem**: "No batch jobs to monitor"

**Solutions**:
1. Check that organizations have active prompts
2. Verify cron secret is correct
3. Check edge function logs for errors

### Jobs Stuck in Processing

**Problem**: Jobs remain in "processing" status with no progress

**Solutions**:
1. Check edge function logs: `batch-reconciler` should auto-resume
2. Verify API keys are configured (OPENAI_API_KEY, etc.)
3. Check for network issues or rate limits

### Tasks Remain Incomplete

**Problem**: Test reports incomplete tasks after timeout

**Solutions**:
1. Increase timeout: `--timeout=180` (3 hours)
2. Check logs for specific errors on failed tasks
3. Verify provider API keys are valid
4. Check for circuit breaker triggers in metadata

## Manual Verification

You can also check batch job status directly in the database:

```sql
-- Check all recent batch jobs
SELECT 
  bj.id,
  o.name as org_name,
  bj.status,
  bj.total_tasks,
  bj.completed_tasks,
  bj.failed_tasks,
  bj.total_tasks - bj.completed_tasks - bj.failed_tasks as remaining,
  bj.metadata->>'driver_active' as driver_active,
  bj.created_at
FROM batch_jobs bj
JOIN organizations o ON o.id = bj.org_id
WHERE bj.created_at >= NOW() - INTERVAL '1 day'
ORDER BY bj.created_at DESC;
```

## Edge Function Logs

Monitor the edge functions directly:

1. **daily-batch-trigger**: https://supabase.com/dashboard/project/cgocsffxqyhojtyzniyz/functions/daily-batch-trigger/logs
2. **robust-batch-processor**: https://supabase.com/dashboard/project/cgocsffxqyhojtyzniyz/functions/robust-batch-processor/logs
3. **batch-reconciler**: https://supabase.com/dashboard/project/cgocsffxqyhojtyzniyz/functions/batch-reconciler/logs

## Performance Expectations

For a typical organization with:
- 32 prompts
- 4 providers
- 128 total tasks

**Expected completion time**: 5-15 minutes
- Best case: ~5 minutes (all providers fast)
- Average: ~8-10 minutes (normal provider response times)
- Worst case: ~15 minutes (some retries, slower providers)

For larger organizations:
- 1000 prompts × 4 providers = 4000 tasks
- Expected: 2-6 hours depending on provider performance

The system is now configured with:
- 12-hour wall time limit (extreme safety margin)
- Automatic retries on all errors
- Self-healing via reconciler
- No premature exits

## CI/CD Integration

Add to your CI pipeline:

```yaml
test-scheduler:
  script:
    - npm install @supabase/supabase-js
    - node scripts/test-scheduler-batch.mjs --force --timeout=30
  timeout: 35 minutes
```

## Support

If tests consistently fail:
1. Review edge function logs
2. Check scheduler_runs table for error details
3. Verify all API keys are configured
4. Ensure database has proper RLS policies
