# Scheduler Setup Instructions

The daily scheduler system has been implemented and requires setting up Supabase cron jobs to trigger the `daily-scan` Edge Function.

## Automatic Setup via SQL Migration

The scheduler state table and Edge Function have been created automatically. You need to set up the cron jobs in your Supabase project:

## Manual Cron Setup in Supabase Dashboard

1. **Go to your Supabase project dashboard**
2. **Navigate to**: SQL Editor
3. **Run the following SQL commands** to create the cron jobs:

```sql
-- Enable the pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the daily-scheduler function to run at 7:00 AM UTC (covers EDT - Eastern Daylight Time)
SELECT cron.schedule(
  'daily-scheduler-edt',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/daily-scheduler',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk"}'::jsonb,
    body := '{"trigger": "cron-edt"}'::jsonb
  );
  $$
);

-- Schedule the daily-scheduler function to run at 8:00 AM UTC (covers EST - Eastern Standard Time)
SELECT cron.schedule(
  'daily-scheduler-est',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/daily-scheduler',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk"}'::jsonb,
    body := '{"trigger": "cron-est"}'::jsonb
  );
  $$
);
```

## How It Works

1. **Dual Scheduling**: Two cron jobs run at 7 AM and 8 AM UTC to handle both EDT and EST timezones
2. **Idempotency**: The Edge Function uses the `scheduler_state` table to ensure only one run per day
3. **Time Check**: The function only executes after 3:00 AM Eastern Time
4. **Automatic Execution**: All active prompts are run automatically with the existing caching and quota logic

## Verify Setup

After setting up the cron jobs, you can verify they're working by:

1. **Check cron jobs**: 
   ```sql
   SELECT * FROM cron.job;
   ```

2. **Monitor scheduler state**:
   ```sql
   SELECT * FROM scheduler_state;
   ```

3. **Check Edge Function logs** in the Supabase Dashboard under Functions > daily-scan > Logs

## Features

- ✅ **Automated daily runs** at 3:00 AM Eastern Time
- ✅ **Idempotent execution** (runs once per day maximum)
- ✅ **DST-aware** with dual UTC scheduling
- ✅ **Cost optimization** with caching and quota limits
- ✅ **No manual intervention** required
- ✅ **Real-time status display** in the UI
- ✅ **Error handling and logging**

## Manual Testing

To manually test the Edge Function (outside the time window):
```bash
curl -X POST https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/daily-scan \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

The function will return status information including whether it's outside the execution window.