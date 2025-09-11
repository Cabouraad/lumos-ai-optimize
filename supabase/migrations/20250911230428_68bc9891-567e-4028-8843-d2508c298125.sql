-- ===== Helpers (idempotent) =====
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

-- ===== Tighten default privileges so new objects aren't public by accident =====
alter default privileges in schema public
  revoke select, insert, update, delete on tables from public, anon;
alter default privileges in schema public
  revoke select on sequences from public, anon;

-- ===== subscribers: remove conflicting policies; install one canonical per-org SELECT =====
alter table public.subscribers enable row level security;
alter table public.subscribers force row level security;

do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname='public' and tablename='subscribers'
  loop
    execute format('drop policy if exists %I on public.subscribers', r.policyname);
  end loop;
end $$;

create policy "subscribers_select_own_org"
on public.subscribers
for select
to authenticated
using (
  user_id = auth.uid()
);

-- Optional update policy (keeps any existing client update flows constrained to same org).
create policy "subscribers_update_own_org"
on public.subscribers
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- ===== subscriber_public view: make it honor RLS and block anon =====
create or replace view public.subscriber_public
with (security_invoker = on)
as
select
  s.id,
  u.org_id,
  s.subscription_tier as tier,
  s.subscription_tier as plan_code,
  case 
    when s.subscribed = true then 'active'
    when s.trial_expires_at > now() then 'trialing'
    else 'inactive'
  end as status,
  s.subscription_end as period_ends_at,
  s.created_at
from public.subscribers s
join public.users u on u.id = s.user_id;

revoke all on table public.subscriber_public from public, anon;
grant select on table public.subscriber_public to authenticated;

-- ===== users table (our app-level users; NOT auth.users): lock to same-org, no anon =====
alter table public.users enable row level security;
alter table public.users force row level security;

do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname='public' and tablename='users'
  loop
    execute format('drop policy if exists %I on public.users', r.policyname);
  end loop;
end $$;

create policy "users_select_own_org"
on public.users
for select
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.org_id = users.org_id
  )
);

revoke all on table public.users from public, anon;
grant select on table public.users to authenticated;
create index if not exists idx_users_org_id on public.users(org_id);

-- ===== organizations table: readable only by members of that org (no anon) =====
alter table public.organizations enable row level security;
alter table public.organizations force row level security;

do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname='public' and tablename='organizations'
  loop
    execute format('drop policy if exists %I on public.organizations', r.policyname);
  end loop;
end $$;

create policy "organizations_select_own_org"
on public.organizations
for select
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.org_id = organizations.id
      and u.id = auth.uid()
  )
);

revoke all on table public.organizations from public, anon;
grant select on table public.organizations to authenticated;

-- ===== subscribers_audit: service-role only (no client reads at all) =====
-- With RLS enabled and *no* SELECT policy, authenticated/anon get zero rows.
-- Service role bypasses RLS as intended for ops.
alter table public.subscribers_audit enable row level security;
alter table public.subscribers_audit force row level security;

do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname='public' and tablename='subscribers_audit'
  loop
    execute format('drop policy if exists %I on public.subscribers_audit', r.policyname);
  end loop;
end $$;

-- No SELECT policy on purpose (=> 0 rows for anon/auth). Keep DML server-side only.
revoke all on table public.subscribers_audit from public, anon, authenticated;

-- ===== Belt-and-suspenders: ensure schema-level CREATE isn't public =====
revoke create on schema public from public;
grant usage on schema public to public;