-- Security Hardening Migration: Force RLS, Secure Views, Move Extensions
-- This migration applies comprehensive security hardening without changing application behavior

-- 1) Helper function (idempotent)
create or replace function public.get_current_org_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select u.org_id
  from public.users u
  where u.id = auth.uid()
  limit 1
$$;

-- 2) Force RLS on all business tables (idempotent)
-- Forcing RLS does NOT change behavior for authenticated users with existing policies
do $$
declare t text;
begin
  foreach t in array array[
    'users',
    'organizations',
    'subscribers',
    'subscribers_audit',
    'prompts',
    'recommendations',
    'reports',
    'weekly_reports',
    'llms_generations',
    'prompt_provider_responses',
    'brand_catalog',
    'suggested_prompts',
    'daily_usage',
    'batch_jobs',
    'batch_tasks',
    'brand_candidates',
    'domain_invitations'
  ]
  loop
    begin
      execute format('alter table public.%I enable row level security;', t);
      execute format('alter table public.%I force row level security;', t);
    exception when undefined_table then
      -- ignore missing optional tables
      continue;
    end;
  end loop;
end $$;

-- Ensure authenticated role can attempt SELECT; RLS policies still govern actual row access
do $$
declare t text;
begin
  foreach t in array array[
    'users','organizations','subscribers','prompts','recommendations','reports',
    'weekly_reports','llms_generations','prompt_provider_responses','brand_catalog',
    'suggested_prompts','daily_usage','subscriber_public'
  ]
  loop
    begin
      execute format('grant select on public.%I to authenticated;', t);
    exception when undefined_table then
      -- ignore missing optional tables
      continue;
    end;
  end loop;
end $$;

-- 3) Secure all views: set security_invoker=on so underlying table RLS is evaluated for the caller
-- This recreates each view definition with the invoker option
do $$
declare r record;
declare view_def text;
begin
  for r in
    select c.oid, n.nspname as schema_name, c.relname as view_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'v' and n.nspname = 'public'
  loop
    -- Get the view definition and clean it up
    view_def := pg_get_viewdef(r.oid, true);
    -- Remove trailing semicolon if present
    view_def := rtrim(view_def, ';');
    
    execute format(
      'create or replace view %I.%I with (security_invoker=on) as %s',
      r.schema_name, r.view_name, view_def
    );
  end loop;
end $$;

-- Lock view/table grants to block anon and generic PUBLIC; keep authenticated
do $$
declare r record;
begin
  -- Revoke from all tables
  for r in
    select table_schema, table_name
    from information_schema.tables
    where table_schema='public'
  loop
    execute format('revoke all on table %I.%I from public, anon;', r.table_schema, r.table_name);
  end loop;

  -- Revoke from all views and grant select to authenticated for common views
  for r in
    select table_schema, table_name
    from information_schema.views
    where table_schema='public'
  loop
    execute format('revoke all on table %I.%I from public, anon;', r.table_schema, r.table_name);
    -- Most views are for authenticated users
    begin
      execute format('grant select on table %I.%I to authenticated;', r.table_schema, r.table_name);
    exception when others then
      -- ignore grant errors for views that shouldn't be accessible
      continue;
    end;
  end loop;
end $$;

-- 4) Move relocatable extensions out of public → extensions schema
create schema if not exists extensions;
do $$
declare r record;
begin
  for r in
    select e.extname, e.oid as ext_oid
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where n.nspname = 'public'
  loop
    if (select extrelocatable from pg_extension where oid = r.ext_oid) then
      execute format('alter extension %I set schema extensions', r.extname);
    end if;
  end loop;
end $$;

-- 5) Lock down schema-level creation and future defaults
revoke create on schema public from public;
grant usage on schema public to public;

alter default privileges in schema public
  revoke select, insert, update, delete on tables from public, anon;
alter default privileges in schema public
  revoke select on sequences from public, anon;

-- Grant necessary access to extensions schema
grant usage on schema extensions to public;