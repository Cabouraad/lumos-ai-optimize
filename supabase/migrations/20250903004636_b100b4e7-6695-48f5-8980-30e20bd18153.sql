-- Add FEATURE_WEEKLY_REPORT feature flag with default false
INSERT INTO feature_flags (flag_name, enabled, description)
VALUES ('FEATURE_WEEKLY_REPORT', false, 'Enable automatic weekly report generation and downloads')
ON CONFLICT (flag_name) 
DO UPDATE SET 
  description = EXCLUDED.description,
  updated_at = now();