-- Fails if a users policy references the users table in its USING/WITH CHECK
select
  pol.polname as policy,
  pol.cmd as command,
  pol.permissive
from pg_policy pol
join pg_class cls on cls.oid = pol.polrelid
where cls.relname = 'users'
  and pg_get_expr(pol.polqual, pol.polrelid) ~* '\bfrom\s+users\b';

-- Expect: zero rows