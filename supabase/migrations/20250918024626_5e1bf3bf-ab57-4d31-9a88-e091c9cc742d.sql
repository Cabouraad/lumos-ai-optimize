-- Fix remaining security linter issues from previous migration  
-- Address RLS policy gaps (use DROP/CREATE instead of IF NOT EXISTS)

-- 1) Add RLS policies for tables that don't have them but have RLS enabled

-- audit_events: only service role and admins should access
DROP POLICY IF EXISTS "audit_events_service_admin_only" ON public.audit_events;
CREATE POLICY "audit_events_service_admin_only"
ON public.audit_events
FOR ALL
USING (
  auth.role() = 'service_role' OR
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('owner', 'admin')
  )
);

-- audit_runs: only service role and admins should access  
DROP POLICY IF EXISTS "audit_runs_service_admin_only" ON public.audit_runs;
CREATE POLICY "audit_runs_service_admin_only"
ON public.audit_runs
FOR ALL
USING (
  auth.role() = 'service_role' OR
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('owner', 'admin')
  )
);

-- scheduler_runs: service role only
DROP POLICY IF EXISTS "scheduler_runs_service_only" ON public.scheduler_runs;
CREATE POLICY "scheduler_runs_service_only"
ON public.scheduler_runs
FOR ALL
USING (auth.role() = 'service_role');

-- scheduler_state: service role only
DROP POLICY IF EXISTS "scheduler_state_service_only" ON public.scheduler_state;
CREATE POLICY "scheduler_state_service_only"
ON public.scheduler_state
FOR ALL  
USING (auth.role() = 'service_role');

-- app_settings: service role only
DROP POLICY IF EXISTS "app_settings_service_only" ON public.app_settings;
CREATE POLICY "app_settings_service_only"
ON public.app_settings
FOR ALL
USING (auth.role() = 'service_role');

-- feature_flags: authenticated users can read, service role can manage
DROP POLICY IF EXISTS "feature_flags_read_authenticated" ON public.feature_flags;
CREATE POLICY "feature_flags_read_authenticated"
ON public.feature_flags
FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "feature_flags_service_manage" ON public.feature_flags;
CREATE POLICY "feature_flags_service_manage"
ON public.feature_flags
FOR ALL
USING (auth.role() = 'service_role');

-- webhook_events: service role only
DROP POLICY IF EXISTS "webhook_events_service_only" ON public.webhook_events;
CREATE POLICY "webhook_events_service_only" 
ON public.webhook_events
FOR ALL
USING (auth.role() = 'service_role');

-- llm_providers: authenticated users can read
DROP POLICY IF EXISTS "llm_providers_read_authenticated" ON public.llm_providers;
CREATE POLICY "llm_providers_read_authenticated"
ON public.llm_providers
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 2) Additional security hardening for sequences
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, sequencename
    FROM pg_sequences
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON SEQUENCE %I.%I FROM public, anon', r.schemaname, r.sequencename);
    EXECUTE format('GRANT USAGE ON SEQUENCE %I.%I TO authenticated', r.schemaname, r.sequencename);
  END LOOP;
END $$;