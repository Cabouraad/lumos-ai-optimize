-- ========== Helpers ==========
-- Function to resolve the current user's org_id via users table.
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

-- ========== Drop existing policies cleanly ==========
drop policy if exists "prompts_select_own_org" on public.prompts;
drop policy if exists "prompts_insert_own_org" on public.prompts;
drop policy if exists "prompts_update_own_org" on public.prompts;
drop policy if exists "prompts_delete_own_org" on public.prompts;
drop policy if exists "recommendations_select_own_org" on public.recommendations;
drop policy if exists "recommendations_insert_own_org" on public.recommendations;
drop policy if exists "recommendations_update_own_org" on public.recommendations;
drop policy if exists "recommendations_delete_own_org" on public.recommendations;
drop policy if exists "subscribers_select_own_org" on public.subscribers;
drop policy if exists "subscribers_update_own_org" on public.subscribers;

-- ========== PROMPTS ==========
alter table public.prompts enable row level security;
alter table public.prompts force row level security;

-- Allow SELECT for authenticated users in their own org
create policy "prompts_select_own_org"
on public.prompts
for select
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.org_id = prompts.org_id
  )
);

-- Allow INSERT by authenticated users; constrain to their org
create policy "prompts_insert_own_org"
on public.prompts
for insert
to authenticated
with check (
  public.get_current_org_id() is not null
  and coalesce(org_id, public.get_current_org_id()) = public.get_current_org_id()
);

-- Allow UPDATE by authenticated users on their org's rows
create policy "prompts_update_own_org"
on public.prompts
for update
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.org_id = prompts.org_id
  )
)
with check (
  coalesce(org_id, public.get_current_org_id()) = public.get_current_org_id()
);

-- Allow DELETE by authenticated users on their org's rows
create policy "prompts_delete_own_org"
on public.prompts
for delete
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.org_id = prompts.org_id
  )
);

create index if not exists idx_prompts_org_id on public.prompts(org_id);

-- ========== RECOMMENDATIONS ==========
alter table public.recommendations enable row level security;
alter table public.recommendations force row level security;

create policy "recommendations_select_own_org"
on public.recommendations
for select
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.org_id = recommendations.org_id
  )
);

create policy "recommendations_insert_own_org"
on public.recommendations
for insert
to authenticated
with check (
  public.get_current_org_id() is not null
  and coalesce(org_id, public.get_current_org_id()) = public.get_current_org_id()
);

create policy "recommendations_update_own_org"
on public.recommendations
for update
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.org_id = recommendations.org_id
  )
)
with check (
  coalesce(org_id, public.get_current_org_id()) = public.get_current_org_id()
);

create policy "recommendations_delete_own_org"
on public.recommendations
for delete
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.org_id = recommendations.org_id
  )
);

create index if not exists idx_recommendations_org_id on public.recommendations(org_id);

-- ========== SUBSCRIBERS hardening ==========
-- Subscribers uses user_id, not org_id, so we secure by user_id
alter table public.subscribers enable row level security;
alter table public.subscribers force row level security;

grant select on public.subscribers to authenticated;

-- Users can only see their own subscription data
create policy "subscribers_select_own_user"
on public.subscribers
for select
to authenticated
using (user_id = auth.uid());

-- Only allow service role to modify subscribers
create policy "subscribers_service_only_mutations"
on public.subscribers
for all
to service_role
using (true)
with check (true);