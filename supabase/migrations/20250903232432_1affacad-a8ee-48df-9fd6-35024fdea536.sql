-- Security Hardening Migration: Address Critical RLS and Schema Security Issues
-- This migration creates an extensions schema and improves RLS policies without breaking functionality

-- 1. Create extensions schema for security isolation
CREATE SCHEMA IF NOT EXISTS extensions;

-- 2. Move common extensions from public to extensions schema for security
-- Note: This requires manual admin action in production - see SECURITY-NOTES.md
-- ALTER EXTENSION IF EXISTS pg_stat_statements SET SCHEMA extensions;
-- ALTER EXTENSION IF EXISTS "uuid-ossp" SET SCHEMA extensions; 
-- ALTER EXTENSION IF EXISTS pgcrypto SET SCHEMA extensions;
-- ALTER EXTENSION IF EXISTS pgjwt SET SCHEMA extensions;
-- ALTER EXTENSION IF EXISTS http SET SCHEMA extensions;

-- 3. Enhance RLS policies for critical tables without breaking service role access

-- Strengthen users table RLS (currently has weak policies)
DROP POLICY IF EXISTS "users_select_own_data_only" ON public.users;
CREATE POLICY "users_select_own_data_strict" 
ON public.users 
FOR SELECT 
TO authenticated 
USING (
  id = auth.uid() AND auth.uid() IS NOT NULL
);

-- Add explicit service role policy for users table
CREATE POLICY "users_service_role_full_access" 
ON public.users 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Enhance subscribers table RLS (currently allows broad access)
DROP POLICY IF EXISTS "subscribers_select_own_secure" ON public.subscribers;
CREATE POLICY "subscribers_select_own_enhanced" 
ON public.subscribers 
FOR SELECT 
TO authenticated 
USING (
  user_id = auth.uid() AND 
  auth.uid() IS NOT NULL AND 
  user_id IS NOT NULL
);

-- Strengthen organizations table access (prevent cross-org data leaks)
DROP POLICY IF EXISTS "org_read" ON public.organizations;
CREATE POLICY "org_read_enhanced" 
ON public.organizations 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() 
      AND u.org_id = organizations.id
      AND u.org_id IS NOT NULL
  )
);

-- Add column-level security for sensitive organization data
REVOKE ALL ON public.organizations FROM authenticated;
GRANT SELECT (id, name, domain, created_at, verified_at, plan_tier, subscription_tier) ON public.organizations TO authenticated;
GRANT UPDATE (name, keywords, products_services, target_audience, business_description, business_city, business_state, business_country, enable_localized_prompts) ON public.organizations TO authenticated;

-- Strengthen prompts table policies (prevent cross-org access)
DROP POLICY IF EXISTS "table_by_org_read" ON public.prompts;
CREATE POLICY "prompts_read_org_strict" 
ON public.prompts 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() 
      AND u.org_id = prompts.org_id
      AND u.org_id IS NOT NULL
  )
);

-- Enhance brand_catalog access (prevent competitor intelligence leaks)
DROP POLICY IF EXISTS "table_by_org_all_brand" ON public.brand_catalog;
CREATE POLICY "brand_catalog_org_members_read" 
ON public.brand_catalog 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() 
      AND u.org_id = brand_catalog.org_id
      AND u.org_id IS NOT NULL
  )
);

CREATE POLICY "brand_catalog_owners_manage" 
ON public.brand_catalog 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() 
      AND u.org_id = brand_catalog.org_id 
      AND u.role = 'owner'
      AND u.org_id IS NOT NULL
  )
) 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() 
      AND u.org_id = brand_catalog.org_id 
      AND u.role = 'owner'
      AND u.org_id IS NOT NULL
  )
);

-- Add audit trail protection (restrict to service role only)
CREATE POLICY "subscribers_audit_service_only_read" 
ON public.subscribers_audit 
FOR SELECT 
TO service_role 
USING (true);

-- Add security functions for policy validation
CREATE OR REPLACE FUNCTION public.validate_org_membership(target_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() 
      AND u.org_id = target_org_id
      AND u.org_id IS NOT NULL
      AND auth.uid() IS NOT NULL
  );
END;
$$;

-- Create security test functions for verification
CREATE OR REPLACE FUNCTION public.test_rls_isolation()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  test_result text := 'PASS';
  user_count integer;
  org_count integer;
BEGIN
  -- Test 1: Verify users table only returns own data
  SELECT COUNT(*) INTO user_count 
  FROM public.users 
  WHERE id != auth.uid();
  
  IF user_count > 0 THEN
    test_result := 'FAIL: Users table leaking cross-user data';
    RETURN test_result;
  END IF;
  
  -- Test 2: Verify organizations table only returns accessible orgs
  SELECT COUNT(*) INTO org_count 
  FROM public.organizations o
  WHERE NOT EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.org_id = o.id
  );
  
  IF org_count > 0 THEN
    test_result := 'FAIL: Organizations table leaking cross-org data';
    RETURN test_result;
  END IF;
  
  RETURN test_result;
END;
$$;

-- Grant execute permissions for test function
GRANT EXECUTE ON FUNCTION public.test_rls_isolation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_org_membership(uuid) TO authenticated;