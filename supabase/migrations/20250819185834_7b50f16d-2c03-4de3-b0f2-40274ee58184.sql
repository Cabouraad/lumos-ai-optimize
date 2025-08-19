-- Create new cron jobs for daily-scheduler function (don't delete old ones since they don't exist)
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