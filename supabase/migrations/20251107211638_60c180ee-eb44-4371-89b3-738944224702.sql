-- Fix weekly reports cron job to use correct authorization

-- Drop the old cron job
SELECT cron.unschedule('weekly-reports-unified');

-- Recreate with proper authorization using anon key and get_cron_secret() function
SELECT cron.schedule(
  'weekly-reports-unified',
  '5 8 * * MON', -- Every Monday at 8:05 AM
  $$
  SELECT net.http_post(
    url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/weekly-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk',
      'x-cron-secret', public.get_cron_secret()
    ),
    body := jsonb_build_object(
      'scheduled', true,
      'timestamp', now()
    )
  );
  $$
);

-- Verify the cron job was created successfully
SELECT jobid, jobname, schedule, active, command 
FROM cron.job 
WHERE jobname = 'weekly-reports-unified';