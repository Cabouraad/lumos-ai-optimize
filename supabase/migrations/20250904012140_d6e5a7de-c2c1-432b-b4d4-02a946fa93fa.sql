-- Assert RLS & column masking without relying on external frameworks.
-- 1) Users: deny reading other users
-- (Pseudo-tests; returns 0 rows when attempting cross-user read)
-- You can inspect locally via SQL runner; keep as documentation if your CI lacks pgTAP.

-- Test 1: Verify RLS is enabled on critical tables
do $$
begin
  -- Assert RLS is enabled on users table
  if not exists (
    select 1 from pg_class c 
    join pg_namespace n on n.oid = c.relnamespace 
    where n.nspname = 'public' 
      and c.relname = 'users' 
      and c.relrowsecurity = true
  ) then
    raise exception 'RLS must be enabled on public.users table';
  end if;
  
  -- Assert RLS is enabled on subscribers table
  if not exists (
    select 1 from pg_class c 
    join pg_namespace n on n.oid = c.relnamespace 
    where n.nspname = 'public' 
      and c.relname = 'subscribers' 
      and c.relrowsecurity = true
  ) then
    raise exception 'RLS must be enabled on public.subscribers table';
  end if;
  
  raise notice '✓ RLS is properly enabled on critical tables';
end $$;

-- Test 2: Verify users table has restrictive policies
do $$
declare
  policy_count int;
begin
  -- Count policies that allow reading other users (should be 0)
  select count(*) into policy_count
  from pg_policies 
  where schemaname = 'public' 
    and tablename = 'users' 
    and cmd = 'SELECT'
    and qual !~ 'auth\.uid\(\)' -- policies that don't reference auth.uid()
    and qual !~ 'service_role'; -- ignore service role policies
    
  if policy_count > 0 then
    raise exception 'Found % overly permissive SELECT policies on users table', policy_count;
  end if;
  
  raise notice '✓ Users table has restrictive RLS policies';
end $$;

-- 2) Subscribers: sensitive columns are hidden for authenticated role
-- NOTE: This is a comment-guided check. In CI or psql, run:
--   set role authenticated;
--   select stripe_customer_id from public.subscribers limit 1;  -- should ERROR: permission denied
--   reset role;

-- Test 3: Verify sensitive columns are protected
do $$
declare
  has_stripe_access boolean := false;
begin
  -- Check if authenticated role has access to sensitive columns
  select exists (
    select 1 from information_schema.column_privileges 
    where grantee = 'authenticated' 
      and table_schema = 'public' 
      and table_name = 'subscribers' 
      and column_name = 'stripe_customer_id'
      and privilege_type = 'SELECT'
  ) into has_stripe_access;
  
  if has_stripe_access then
    raise exception 'Authenticated role should not have SELECT access to stripe_customer_id';
  end if;
  
  raise notice '✓ Sensitive columns are properly protected from authenticated role';
end $$;

-- Test 4: Document manual verification steps
do $$
begin
  raise notice '=== MANUAL VERIFICATION REQUIRED ===';
  raise notice 'Run these commands in psql to verify column security:';
  raise notice '  SET ROLE authenticated;';
  raise notice '  SELECT stripe_customer_id FROM public.subscribers LIMIT 1; -- Should ERROR';
  raise notice '  RESET ROLE;';
  raise notice '=== END MANUAL VERIFICATION ===';
end $$;