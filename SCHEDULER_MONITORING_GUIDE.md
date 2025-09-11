# Scheduler Monitoring Guide

## Overview

The enhanced scheduler system now provides comprehensive tracking of prompt execution across all organizations, ensuring that the number of prompts run corresponds exactly with the number of active prompts in the system.

## Key Features

### 1. Prompt-Level Coverage Tracking
- **Real-time counting**: System dynamically counts all active prompts across all organizations
- **Granular verification**: Tracks individual prompt execution, not just organization-level completion
- **Missing prompt identification**: Shows exactly which prompts didn't run and which organizations they belong to

### 2. Enhanced Postcheck Function

The `scheduler-postcheck` function now provides:

#### Standard Mode (Read-only)
```bash
curl -X POST https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/scheduler-postcheck \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

#### Repair Mode (Self-healing)
```bash
curl -X POST https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/scheduler-postcheck?repair=true \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

### 3. Enhanced Metrics

The postcheck now returns:

```json
{
  "promptCoverage": {
    "expectedActivePrompts": 245,
    "promptsRunToday": 240,
    "coveragePercent": 98,
    "missingPromptsCount": 5,
    "missingPromptsByOrg": {
      "org-uuid-1": [
        {
          "id": "prompt-uuid",
          "text": "What are the best project management tools...",
          "org_name": "TechCorp"
        }
      ]
    }
  },
  "orgCoverage": {
    "expected": 25,
    "found": 24,
    "missing": 1
  },
  "summary": {
    "overallHealth": "HEALTHY" // or "NEEDS_ATTENTION"
    "promptCoveragePercent": 98,
    "orgCoveragePercent": 96
  }
}
```

## Monitoring SQL Queries

### Check Today's Prompt Coverage
```sql
SELECT 
  COUNT(DISTINCT p.id) as total_active_prompts,
  COUNT(DISTINCT ppr.prompt_id) as prompts_run_today,
  ROUND(
    (COUNT(DISTINCT ppr.prompt_id)::numeric / COUNT(DISTINCT p.id)) * 100, 
    1
  ) as coverage_percent
FROM prompts p
LEFT JOIN prompt_provider_responses ppr ON ppr.prompt_id = p.id 
  AND ppr.run_at >= CURRENT_DATE 
  AND ppr.status = 'success'
WHERE p.active = true;
```

### Find Missing Prompts by Organization
```sql
SELECT 
  o.name as org_name,
  p.id,
  LEFT(p.text, 80) || '...' as prompt_preview
FROM prompts p
JOIN organizations o ON o.id = p.org_id
LEFT JOIN prompt_provider_responses ppr ON ppr.prompt_id = p.id 
  AND ppr.run_at >= CURRENT_DATE 
  AND ppr.status = 'success'
WHERE p.active = true 
  AND ppr.id IS NULL
ORDER BY o.name, p.text;
```

### Check Scheduler Run History
```sql
SELECT 
  function_name,
  run_key,
  status,
  started_at,
  completed_at,
  result->'summary'->>'overallHealth' as health,
  result->'promptCoverage'->>'coveragePercent' as prompt_coverage,
  result->'orgCoverage'->>'found' as orgs_completed
FROM scheduler_runs 
WHERE started_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY started_at DESC;
```

## Tonight's Run (3:00 AM ET)

### Expected Timeline
1. **03:00:00 ET** - `daily-batch-trigger` starts
2. **03:00:30 ET** - Multiple `robust-batch-processor` jobs begin
3. **03:45:00 ET** - `batch-reconciler` runs (fixes stuck jobs)
4. **04:00:00 ET** - `scheduler-postcheck` runs (verifies coverage)

### Health Indicators
- ✅ **HEALTHY**: `promptCoveragePercent >= 95%` AND `orgCoveragePercent >= 95%`
- ❌ **NEEDS_ATTENTION**: Below 95% coverage on either metric

### Automatic Healing
- The postcheck function can automatically trigger healing for missing organizations
- Use `?repair=true` parameter to enable self-healing mode
- Healing attempts are logged in the response for audit purposes

## Log Locations

### Edge Function Logs
- **Daily Batch Trigger**: [View Logs](https://supabase.com/dashboard/project/cgocsffxqyhojtyzniyz/functions/daily-batch-trigger/logs)
- **Batch Processor**: [View Logs](https://supabase.com/dashboard/project/cgocsffxqyhojtyzniyz/functions/robust-batch-processor/logs)
- **Postcheck**: [View Logs](https://supabase.com/dashboard/project/cgocsffxqyhojtyzniyz/functions/scheduler-postcheck/logs)

### Database Logs
```sql
-- View recent scheduler runs
SELECT * FROM scheduler_runs 
WHERE started_at >= CURRENT_DATE 
ORDER BY started_at DESC;

-- View batch job status
SELECT org_id, status, total_tasks, completed_tasks, failed_tasks
FROM batch_jobs 
WHERE created_at >= CURRENT_DATE;
```

## Troubleshooting

### If Prompts Are Missing
1. Check individual organization batch jobs
2. Look for failed tasks in `batch_tasks` table
3. Verify API keys are properly configured
4. Run postcheck with `?repair=true` to attempt healing

### If Coverage Is Low
1. Run manual validation: `test-scheduler-audit.js`
2. Check for quota/subscription issues
3. Verify all providers are accessible
4. Consider running `manual-daily-run` for specific organizations

## Success Criteria for Tonight

✅ **Target**: 100% of active prompts run successfully
✅ **Minimum**: 95% prompt coverage across all organizations  
✅ **Monitoring**: Postcheck shows "HEALTHY" status
✅ **Logging**: All runs properly recorded in `scheduler_runs` table