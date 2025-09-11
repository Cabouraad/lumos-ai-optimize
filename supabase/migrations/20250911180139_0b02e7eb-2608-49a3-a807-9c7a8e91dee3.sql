-- 1) Lock down the base table
alter table public.subscribers enable row level security;
revoke all on table public.subscribers from anon, authenticated;

-- 2) Narrow, non-sensitive view for browser reads
-- security_invoker ensures underlying table RLS evaluates with the caller's rights
create or replace view public.subscriber_public
with (security_invoker = on)
as
select
  s.id,
  u.org_id,
  s.subscription_tier as tier,
  s.subscription_tier as plan_code,
  CASE 
    WHEN s.subscribed = true THEN 'active'
    WHEN s.trial_expires_at > now() THEN 'trialing'
    ELSE 'inactive'
  END as status,
  s.subscription_end as period_ends_at,
  s.created_at
from public.subscribers s
join public.users u on u.id = s.user_id;

-- 3) Per-org read policy (applies when selecting through the view)
drop policy if exists "read own org subscriber via view" on public.subscribers;
create policy "read own org subscriber via view"
on public.subscribers
for select
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.id = subscribers.user_id
  )
);