-- =====================================================
-- Weekly Reports System Fix - Storage & Permissions Only
-- Note: Cron jobs must be configured via Supabase dashboard
-- =====================================================

-- 1. ADD STORAGE RLS POLICIES FOR WEEKLY REPORTS BUCKET
DROP POLICY IF EXISTS "Users can download their org's weekly reports" ON storage.objects;
CREATE POLICY "Users can download their org's weekly reports"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'weekly-reports' 
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT org_id FROM users WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Service role can manage weekly reports" ON storage.objects;
CREATE POLICY "Service role can manage weekly reports"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'weekly-reports')
WITH CHECK (bucket_id = 'weekly-reports');

-- 2. ADD STORAGE RLS POLICIES FOR REPORTS (PDF) BUCKET
DROP POLICY IF EXISTS "Users can download their org's PDF reports" ON storage.objects;
CREATE POLICY "Users can download their org's PDF reports"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'reports'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT org_id FROM users WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Service role can manage PDF reports" ON storage.objects;
CREATE POLICY "Service role can manage PDF reports"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'reports')
WITH CHECK (bucket_id = 'reports');

-- 3. ADD INDEXES FOR FASTER REPORT LOOKUPS
CREATE INDEX IF NOT EXISTS idx_weekly_reports_org_week 
ON weekly_reports(org_id, week_start_date);

CREATE INDEX IF NOT EXISTS idx_reports_org_week
ON reports(org_id, week_key);

-- 4. ADD FUNCTION TO GET CRON JOB STATUS
CREATE OR REPLACE FUNCTION public.get_weekly_report_cron_status()
RETURNS TABLE(
  job_name text,
  schedule text,
  active boolean,
  last_run timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    j.jobname::text,
    j.schedule::text,
    j.active,
    (SELECT MAX(start_time) FROM cron.job_run_details WHERE jobid = j.jobid)
  FROM cron.job j
  WHERE j.jobname LIKE '%weekly%'
  ORDER BY j.jobname
  LIMIT 10;
$$;

GRANT EXECUTE ON FUNCTION public.get_weekly_report_cron_status() TO authenticated;