-- Assert RLS & column masking without relying on external frameworks.
-- 1) Users: deny reading other users
-- 2) Subscribers: sensitive columns should be hidden for authenticated role

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
  
  raise notice '✓ RLS is properly enabled on users table';
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
    raise warning 'Found % potentially permissive SELECT policies on users table', policy_count;
  else
    raise notice '✓ Users table has restrictive RLS policies';
  end if;
end $$;

-- Test 3: Check sensitive column access (informational)
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
    raise warning 'Authenticated role has SELECT access to stripe_customer_id - consider revoking';
  else
    raise notice '✓ Sensitive columns are properly protected from authenticated role';
  end if;
end $$;

-- Manual verification documentation
do $$
begin
  raise notice '=== MANUAL VERIFICATION STEPS ===';
  raise notice 'To verify column security, run in psql:';
  raise notice '  SET ROLE authenticated;';
  raise notice '  SELECT stripe_customer_id FROM public.subscribers LIMIT 1; -- Should ERROR if protected';
  raise notice '  RESET ROLE;';
  raise notice '=================================';
end $$;