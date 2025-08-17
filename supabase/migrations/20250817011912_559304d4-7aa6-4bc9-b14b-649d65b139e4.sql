-- Move extensions to extensions schema for better security
CREATE SCHEMA IF NOT EXISTS extensions;

-- Drop extensions from public schema and recreate in extensions schema
DROP EXTENSION IF EXISTS pg_cron;
DROP EXTENSION IF EXISTS pg_net;

-- Recreate extensions in the extensions schema
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Recreate the cron jobs with proper schema references
SELECT extensions.cron.schedule(
  'daily-scan-edt',
  '0 7 * * *',
  $$
  SELECT extensions.net.http_post(
    url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/daily-scan',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk"}'::jsonb,
    body := '{"trigger": "cron-edt"}'::jsonb
  );
  $$
);

SELECT extensions.cron.schedule(
  'daily-scan-est', 
  '0 8 * * *',
  $$
  SELECT extensions.net.http_post(
    url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/daily-scan',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk"}'::jsonb,
    body := '{"trigger": "cron-est"}'::jsonb
  );
  $$
);