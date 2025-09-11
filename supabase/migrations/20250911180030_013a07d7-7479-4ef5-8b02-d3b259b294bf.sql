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
  s.org_id,
  s.tier,
  s.plan_code,
  s.status,
  s.period_ends_at,
  s.created_at
from public.subscribers s;

-- 3) Per-org read policy (applies when selecting through the view)
drop policy if exists "read own org subscriber via view" on public.subscribers;
create policy "read own org subscriber via view"
on public.subscribers
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.org_id = subscribers.org_id
  )
);