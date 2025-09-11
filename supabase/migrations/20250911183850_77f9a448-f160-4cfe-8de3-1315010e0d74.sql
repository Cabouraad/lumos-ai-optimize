-- ========== Helpers ==========
-- Function to resolve the current user's org_id via profiles.
create or replace function public.get_current_org_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select p.org_id
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;

-- Generic trigger to set org_id at insert time if missing.
create or replace function public.tg_set_org_id_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_id is null then
    new.org_id := public.get_current_org_id();
  end if;
  return new;
end;
$$;

-- Utility: drop existing policies cleanly so we can re-create canonical ones.
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, polname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('prompts','recommendations','subscribers')
  loop
    execute format('drop policy if exists %I on public.%I', r.polname, r.tablename);
  end loop;
end $$;

-- ========== PROMPTS ==========
alter table public.prompts enable row level security;
alter table public.prompts force row level security;

-- Ensure org_id exists on insert (non-disruptive; fills when missing)
drop trigger if exists trg_prompts_set_org on public.prompts;
create trigger trg_prompts_set_org
  before insert on public.prompts
  for each row execute function public.tg_set_org_id_from_profile();

-- Allow SELECT for authenticated users in their own org
create policy "prompts_select_own_org"
on public.prompts
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.org_id = prompts.org_id
  )
);

-- Allow INSERT by authenticated users; constrain to their org
create policy "prompts_insert_own_org"
on public.prompts
for insert
to authenticated
with check (
  public.get_current_org_id() is not null
  and new.org_id = public.get_current_org_id()
);

-- Allow UPDATE by authenticated users on their org's rows
create policy "prompts_update_own_org"
on public.prompts
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.org_id = prompts.org_id
  )
)
with check (
  new.org_id = public.get_current_org_id()
);

-- Allow DELETE by authenticated users on their org's rows (if app uses it)
create policy "prompts_delete_own_org"
on public.prompts
for delete
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.org_id = prompts.org_id
  )
);

create index if not exists idx_prompts_org_id on public.prompts(org_id);

-- ========== RECOMMENDATIONS ==========
alter table public.recommendations enable row level security;
alter table public.recommendations force row level security;

drop trigger if exists trg_recommendations_set_org on public.recommendations;
create trigger trg_recommendations_set_org
  before insert on public.recommendations
  for each row execute function public.tg_set_org_id_from_profile();

create policy "recommendations_select_own_org"
on public.recommendations
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.org_id = recommendations.org_id
  )
);

create policy "recommendations_insert_own_org"
on public.recommendations
for insert
to authenticated
with check (
  public.get_current_org_id() is not null
  and new.org_id = public.get_current_org_id()
);

create policy "recommendations_update_own_org"
on public.recommendations
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.org_id = recommendations.org_id
  )
)
with check (
  new.org_id = public.get_current_org_id()
);

create policy "recommendations_delete_own_org"
on public.recommendations
for delete
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.org_id = recommendations.org_id
  )
);

create index if not exists idx_recommendations_org_id on public.recommendations(org_id);

-- ========== SUBSCRIBERS hardening ==========
-- Keep your existing UI behavior. We tighten RLS and ensure only same-org reads.
alter table public.subscribers enable row level security;
alter table public.subscribers force row level security;

-- Optionally ensure authenticated roles have SELECT privilege (RLS still applies).
-- This enables selecting via views if you are using one elsewhere.
grant select on public.subscribers to authenticated;

-- Canonical per-org SELECT policy
create policy "subscribers_select_own_org"
on public.subscribers
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.org_id = subscribers.org_id
  )
);

-- Optional: constrain updates to same org (only if app updates this table from client)
create policy "subscribers_update_own_org"
on public.subscribers
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.org_id = subscribers.org_id
  )
)
with check (
  new.org_id = public.get_current_org_id()
);

create index if not exists idx_subscribers_org_id on public.subscribers(org_id);