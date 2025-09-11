-- Schema: public
-- Adds a function public.run_security_audit() returning a consolidated report of exposures.

create or replace function public.run_security_audit()
returns table(
  severity text,
  item_kind text,        -- TABLE | VIEW | EXTENSION
  schema_name text,
  object_name text,
  issue text,
  details text,
  fix_hint text
)
language sql
security definer
set search_path = public
as $$
with
-- All tables and views in 'public'
objs as (
  select
    n.nspname as schema_name,
    c.relname  as object_name,
    case c.relkind
      when 'r' then 'TABLE'
      when 'v' then 'VIEW'
      when 'm' then 'MATERIALIZED VIEW'
      else c.relkind::text
    end as item_kind,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced,
    c.oid as oid
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r','v','m')
),
-- Grants to PUBLIC or anon on tables/views in public
grants as (
  select
    t.table_schema as schema_name,
    t.table_name   as object_name,
    max(case when grantee ilike 'public' then 1 else 0 end) as has_public,
    max(case when grantee ilike 'anon'   then 1 else 0 end) as has_anon,
    string_agg(distinct privilege_type, ', ' order by privilege_type) as privileges
  from information_schema.table_privileges t
  where t.table_schema = 'public'
  group by t.table_schema, t.table_name
),
-- Check views for security_invoker using pg_rewrite
view_security_invoker as (
  select 
    n.nspname as schema_name,
    c.relname as object_name,
    exists(
      select 1 from pg_rewrite r
      where r.ev_class = c.oid 
      and r.ev_action is not null
      and position('security_invoker' in pg_get_viewdef(c.oid, true)) > 0
    ) as has_security_invoker
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'v'
),
-- Extensions that are still in public (and relocatable)
bad_extensions as (
  select e.extname as object_name,
         n.nspname as schema_name,
         e.extrelocatable as relocatable
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where n.nspname = 'public'
)

-- Findings: public/anon SELECT on any table/view
select
  case when (g.has_public=1 or g.has_anon=1) and (position('SELECT' in g.privileges)>0)
       then 'CRITICAL' else 'INFO' end as severity,
  o.item_kind,
  o.schema_name,
  o.object_name,
  'Public or anon SELECT grant' as issue,
  'Grants: '||coalesce(g.privileges,'<none>') as details,
  'REVOKE ALL ON public.'||quote_ident(o.object_name)||' FROM PUBLIC, anon; GRANT SELECT TO authenticated (if needed).' as fix_hint
from objs o
left join grants g
  on g.schema_name=o.schema_name and g.object_name=o.object_name
where (g.has_public=1 or g.has_anon=1)
  and position('SELECT' in coalesce(g.privileges,''))>0

union all

-- Findings: RLS disabled or not forced on TABLES only
select
  'HIGH' as severity,
  o.item_kind,
  o.schema_name,
  o.object_name,
  case when not o.rls_enabled then 'RLS disabled' else 'RLS not forced' end as issue,
  'relrowsecurity='||o.rls_enabled||', relforcerowsecurity='||o.rls_forced as details,
  'ALTER TABLE public.'||quote_ident(o.object_name)||' ENABLE ROW LEVEL SECURITY; ALTER TABLE public.'||quote_ident(o.object_name)||' FORCE ROW LEVEL SECURITY;' as fix_hint
from objs o
where o.item_kind='TABLE'
  and (not o.rls_enabled or not o.rls_forced)

union all

-- Findings: views without security_invoker (best practice if they expose RLS'd sources)
select
  'MEDIUM' as severity,
  'VIEW' as item_kind,
  v.schema_name,
  v.object_name,
  'View not SECURITY INVOKER' as issue,
  'Consider: CREATE OR REPLACE VIEW ... WITH (security_invoker=on)' as details,
  'CREATE OR REPLACE VIEW public.'||quote_ident(v.object_name)||' WITH (security_invoker=on) AS ...' as fix_hint
from view_security_invoker v
where not v.has_security_invoker

union all

-- Findings: relocatable extensions living in public
select
  'LOW' as severity,
  'EXTENSION' as item_kind,
  be.schema_name,
  be.object_name,
  'Extension installed in public schema' as issue,
  'Relocatable='||be.relocatable as details,
  'ALTER EXTENSION '||quote_ident(be.object_name)||' SET SCHEMA extensions;' as fix_hint
from bad_extensions be

order by severity desc, item_kind, object_name;
$$;

comment on function public.run_security_audit() is
'Returns CRITICAL/HIGH/MEDIUM/LOW security findings: public/anon SELECT grants, RLS off/not forced, non-invoker views, and extensions in public.';