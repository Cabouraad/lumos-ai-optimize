-- Insert the cron secret placeholder into app_settings
INSERT INTO public.app_settings (key, value, description)
VALUES (
  'cron_secret',
  'UPDATE_WITH_ACTUAL_CRON_SECRET_VALUE',
  'Secret used for authenticating cron job requests'
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();