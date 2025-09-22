-- Force RLS and secure all views (simplified, idempotent migration)
-- This ensures all tables have RLS enabled and views are secure

DO $$
DECLARE t text;
BEGIN
  -- Force RLS on critical tables
  FOREACH t IN ARRAY ARRAY['users','organizations','subscribers','subscribers_audit','prompts','recommendations','reports','weekly_reports','batch_jobs','batch_tasks','prompt_provider_responses','brand_catalog','suggested_prompts','daily_usage']
  LOOP
    EXECUTE format('ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE IF EXISTS public.%I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Secure all views to honor caller's RLS (security_invoker=on)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.oid, n.nspname, c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind='v' AND n.nspname='public'
  LOOP
    EXECUTE format('CREATE OR REPLACE VIEW %I.%I WITH (security_invoker=on) AS %s',
      r.nspname, r.relname, pg_get_viewdef(r.oid, true));
  END LOOP;
END $$;

-- Revoke default permissions and set proper access
DO $$
DECLARE r record;
BEGIN
  -- Revoke from tables
  FOR r IN SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema='public'
  LOOP
    EXECUTE format('REVOKE ALL ON %I.%I FROM public, anon', r.table_schema, r.table_name);
  END LOOP;
  
  -- Revoke from views and grant authenticated select
  FOR r IN SELECT table_schema, table_name FROM information_schema.views WHERE table_schema='public'
  LOOP
    EXECUTE format('REVOKE ALL ON %I.%I FROM public, anon', r.table_schema, r.table_name);
    EXECUTE format('GRANT SELECT ON %I.%I TO authenticated', r.table_schema, r.table_name);
  END LOOP;
END $$;

-- Secure public schema
REVOKE CREATE ON SCHEMA public FROM public;
GRANT USAGE ON SCHEMA public TO public;

-- Set secure defaults for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM public, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON SEQUENCES FROM public, anon;