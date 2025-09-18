-- Fix remaining security linter issues from previous migration
-- Address RLS policy gaps and remaining security concerns

-- 1) Add RLS policies for tables that don't have them but have RLS enabled
-- These are likely system/audit tables that need specific access patterns

-- audit_events: only service role and admins should access
CREATE POLICY IF NOT EXISTS "audit_events_service_admin_only"
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
CREATE POLICY IF NOT EXISTS "audit_runs_service_admin_only"
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
CREATE POLICY IF NOT EXISTS "scheduler_runs_service_only"
ON public.scheduler_runs
FOR ALL
USING (auth.role() = 'service_role');

-- scheduler_state: service role only
CREATE POLICY IF NOT EXISTS "scheduler_state_service_only"
ON public.scheduler_state
FOR ALL  
USING (auth.role() = 'service_role');

-- app_settings: service role only
CREATE POLICY IF NOT EXISTS "app_settings_service_only"
ON public.app_settings
FOR ALL
USING (auth.role() = 'service_role');

-- feature_flags: authenticated users can read, service role can manage
CREATE POLICY IF NOT EXISTS "feature_flags_read_authenticated"
ON public.feature_flags
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY IF NOT EXISTS "feature_flags_service_manage"
ON public.feature_flags
FOR ALL
USING (auth.role() = 'service_role');

-- webhook_events: service role only
CREATE POLICY IF NOT EXISTS "webhook_events_service_only" 
ON public.webhook_events
FOR ALL
USING (auth.role() = 'service_role');

-- llm_providers: authenticated users can read
CREATE POLICY IF NOT EXISTS "llm_providers_read_authenticated"
ON public.llm_providers
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 2) Attempt to move remaining extensions from public schema
-- This addresses the extension_in_public warning
DO $$
DECLARE 
  r RECORD;
BEGIN
  -- Create extensions schema if it doesn't exist
  CREATE SCHEMA IF NOT EXISTS extensions;
  
  -- Move remaining relocatable extensions
  FOR r IN
    SELECT e.extname
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace  
    WHERE n.nspname = 'public' AND e.extrelocatable = true
  LOOP
    BEGIN
      EXECUTE format('ALTER EXTENSION %I SET SCHEMA extensions', r.extname);
    EXCEPTION WHEN OTHERS THEN
      -- Log but continue if extension can't be moved
      RAISE NOTICE 'Could not move extension % to extensions schema: %', r.extname, SQLERRM;
    END;
  END LOOP;
END $$;

-- 3) Additional security hardening
-- Ensure sequences follow the same security model
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