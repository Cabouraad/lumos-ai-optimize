-- Ensure base table is protected by RLS (idempotent hardening)
alter table public.subscribers enable row level security;
alter table public.subscribers force row level security;

-- Canonical per-org read policy (authenticated only)
drop policy if exists "subscribers_select_own_org" on public.subscribers;
create policy "subscribers_select_own_org"
on public.subscribers
for select
to authenticated
using (
  user_id = auth.uid()
);

-- Recreate the safe view: security_invoker makes RLS evaluate as the caller
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

-- Lock the view grants: no public/anon; only authenticated may select
revoke all on table public.subscriber_public from public, anon;
grant select on table public.subscriber_public to authenticated;

-- Future-proof: no automatic grants to anon for new tables/views in public schema
alter default privileges in schema public
  revoke select on tables from anon, public;