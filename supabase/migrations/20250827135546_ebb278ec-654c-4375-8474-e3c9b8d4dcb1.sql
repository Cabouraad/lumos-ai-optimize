-- Directly insert the cron secret into app_settings
-- This is equivalent to what the sync-cron-secret function would do
INSERT INTO public.app_settings (key, value, description)
VALUES (
  'cron_secret',
  (SELECT current_setting('my.cron_secret', true)), -- This will be null but we'll update it manually
  'Secret used for authenticating cron job requests'
)
ON CONFLICT (key) DO NOTHING;

-- Since we can't access the env variable directly, let's create a placeholder
-- and you can update it manually with the actual CRON_SECRET value
UPDATE public.app_settings 
SET value = 'PLACEHOLDER_UPDATE_WITH_ACTUAL_CRON_SECRET'
WHERE key = 'cron_secret';