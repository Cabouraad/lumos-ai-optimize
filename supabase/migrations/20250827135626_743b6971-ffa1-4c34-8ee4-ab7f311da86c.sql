-- Update the cron_secret with the actual value
-- Replace 'YOUR_ACTUAL_CRON_SECRET_HERE' with the real CRON_SECRET from your Supabase secrets
UPDATE public.app_settings 
SET 
  value = (SELECT current_setting('app.settings.cron_secret')),
  updated_at = now()
WHERE key = 'cron_secret';

-- Since we can't access env vars directly in SQL, let's use a more direct approach
-- You'll need to replace this with your actual CRON_SECRET value from the Supabase dashboard
UPDATE public.app_settings 
SET 
  value = 'your-actual-cron-secret-value-here',
  updated_at = now()
WHERE key = 'cron_secret';