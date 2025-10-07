# Weekly Reports Cron Job Setup Guide

## Overview
This guide explains how to configure the consolidated cron job for weekly report generation.

## Prerequisites
1. **CRON_SECRET** must be set in your Supabase secrets
2. Edge function `weekly-report` must be deployed
3. Storage buckets `weekly-reports` and `reports` must exist
4. RLS policies must be configured (done via migration)

## Setting up CRON_SECRET

### Option 1: Via Supabase Dashboard
1. Go to [Supabase Dashboard > Settings > Edge Functions](https://supabase.com/dashboard/project/cgocsffxqyhojtyzniyz/settings/functions)
2. Add a new secret:
   - Name: `CRON_SECRET`
   - Value: Generate a secure random string (e.g., `openssl rand -hex 32`)
3. Save the secret

### Option 2: Via SQL (storing in app_settings)
```sql
-- Generate and store a secure cron secret
INSERT INTO app_settings (key, value, description)
VALUES (
  'cron_secret',
  encode(gen_random_bytes(32), 'hex'),
  'Secret for authenticating cron job requests'
)
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value;

-- View the generated secret (you'll need this for the cron job)
SELECT value FROM app_settings WHERE key = 'cron_secret';
```

## Configuring the Cron Job

### Step 1: Delete Existing Duplicate Jobs
Run this SQL in the Supabase SQL Editor:

```sql
-- Remove any existing weekly report cron jobs
DELETE FROM cron.job 
WHERE jobname IN (
  'weekly-reports-pdf-csv', 
  'weekly-csv-reports', 
  'weekly-pdf-reports',
  'weekly-reports-unified'
);
```

### Step 2: Create the Unified Cron Job
Run this SQL (replace `YOUR_CRON_SECRET` with your actual secret):

```sql
-- Create single consolidated cron job
-- Runs every Monday at 08:00 UTC
SELECT cron.schedule(
  'weekly-reports-unified',
  '0 8 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/weekly-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'YOUR_CRON_SECRET'
    ),
    body := jsonb_build_object(
      'scheduled', true,
      'timestamp', now()
    )
  ) as request_id;
  $$
);
```

### Step 3: Verify the Cron Job
```sql
-- Check cron job status
SELECT * FROM public.get_weekly_report_cron_status();

-- View all cron jobs
SELECT 
  jobname,
  schedule,
  active,
  command
FROM cron.job
WHERE jobname = 'weekly-reports-unified';

-- Check recent cron job runs
SELECT 
  runid,
  jobid,
  start_time,
  end_time,
  status,
  return_message
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'weekly-reports-unified')
ORDER BY start_time DESC
LIMIT 10;
```

## Cron Schedule Options

The cron schedule uses standard cron syntax: `minute hour day-of-month month day-of-week`

Examples:
- `0 8 * * 1` - Every Monday at 08:00 UTC
- `0 6 * * 1` - Every Monday at 06:00 UTC  
- `0 0 * * 1` - Every Monday at midnight UTC
- `0 8 * * 0` - Every Sunday at 08:00 UTC

## Testing the Cron Job

### Manual Test via SQL
```sql
-- Trigger the cron job manually
SELECT net.http_post(
  url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/weekly-report',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-cron-secret', 'YOUR_CRON_SECRET'
  ),
  body := jsonb_build_object(
    'scheduled', true,
    'timestamp', now()
  )
);
```

### Manual Test via curl
```bash
curl -X POST \
  https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/weekly-report \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: YOUR_CRON_SECRET" \
  -d '{"scheduled": true}'
```

### Check Edge Function Logs
1. Go to [Edge Functions Logs](https://supabase.com/dashboard/project/cgocsffxqyhojtyzniyz/functions/weekly-report/logs)
2. Look for entries with `[WEEKLY-REPORT]` prefix
3. Verify successful report generation

## Monitoring

### Check Scheduler Runs
```sql
-- View recent scheduler runs
SELECT 
  id,
  run_key,
  function_name,
  status,
  started_at,
  completed_at,
  result,
  error_message
FROM scheduler_runs
WHERE function_name = 'weekly-report'
ORDER BY started_at DESC
LIMIT 10;
```

### Check Generated Reports
```sql
-- View recent weekly reports (CSV)
SELECT 
  org_id,
  week_start_date,
  week_end_date,
  status,
  generated_at,
  file_size_bytes,
  metadata
FROM weekly_reports
ORDER BY generated_at DESC
LIMIT 10;

-- View recent PDF reports
SELECT 
  org_id,
  week_key,
  period_start,
  period_end,
  byte_size,
  created_at
FROM reports
ORDER BY created_at DESC
LIMIT 10;
```

## Troubleshooting

### Issue: Cron job shows as succeeded but no reports generated

**Cause**: HTTP request may not be reaching the edge function

**Fix**:
1. Check that the edge function URL is correct
2. Verify CRON_SECRET matches between cron job and edge function
3. Check edge function logs for incoming requests
4. Verify pg_net extension is enabled

```sql
-- Enable pg_net if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### Issue: "Authentication required" errors

**Cause**: CRON_SECRET mismatch or missing

**Fix**:
1. Verify CRON_SECRET is set in Supabase secrets
2. Ensure cron job SQL uses correct header name: `x-cron-secret`
3. Check edge function expects `x-cron-secret` header (not `Bearer` token)

### Issue: Reports generated but users can't download

**Cause**: Missing RLS policies on storage buckets

**Fix**: Run the storage RLS migration again
```sql
-- This should have been done in the migration, but verify:
CREATE POLICY "Users can download their org's weekly reports"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'weekly-reports' 
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT org_id FROM users WHERE id = auth.uid()
  )
);
```

## Architecture

The weekly report system now uses a **unified architecture**:

```
┌─────────────────┐
│   Cron Job      │
│  (Every Monday) │
└────────┬────────┘
         │ HTTP POST with x-cron-secret
         ▼
┌─────────────────────┐
│  weekly-report      │ ← Single edge function
│  Edge Function      │   (handles both PDF and CSV)
└─────────┬───────────┘
          │
          ├─ Generates PDF → reports/
          └─ Generates CSV → weekly-reports/
```

### Key Changes from Old System
1. **Consolidated Functions**: Single `weekly-report` function replaces separate PDF/CSV functions
2. **Consistent Authentication**: Uses `x-cron-secret` header (not Bearer token)
3. **Shared Week Utility**: Both functions use `getLastCompleteWeekUTC()` for consistency
4. **Proper PDF Generation**: Uses pdf-lib instead of placeholder text
5. **Storage RLS**: Users can download their own organization's reports

## Related Files
- Edge Function: `supabase/functions/weekly-report/index.ts`
- Week Utility: `supabase/functions/_shared/report/week.ts`
- PDF Generator: `supabase/functions/_shared/report/pdf-enhanced.ts`
- Migration: Latest migration in `supabase/migrations/`
