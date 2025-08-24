
-- Create the provider-level persistence table used by execute-prompt
create table if not exists public.prompt_provider_responses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  prompt_id uuid not null,
  provider text not null,
  model text,
  status text not null,
  run_at timestamptz not null default now(),
  -- visibility fields
  score integer not null default 0,
  org_brand_present boolean not null default false,
  org_brand_prominence integer,
  competitors_count integer not null default 0,
  brands_json jsonb not null default '[]'::jsonb,
  competitors_json jsonb not null default '[]'::jsonb,
  -- raw/debug
  raw_ai_response text,
  raw_evidence text,
  error text,
  token_in integer not null default 0,
  token_out integer not null default 0,
  metadata jsonb not null default '{}'::jsonb
);

-- RLS
alter table public.prompt_provider_responses enable row level security;

-- Service can write (insert/update/delete) - used by edge functions with service role
create policy "ppr_service_insert"
on public.prompt_provider_responses
for insert
to public
with check (auth.role() = 'service_role');

create policy "ppr_service_update"
on public.prompt_provider_responses
for update
to public
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "ppr_service_delete"
on public.prompt_provider_responses
for delete
to public
using (auth.role() = 'service_role');

-- Org members can read rows for their org (owners and members)
create policy "ppr_select_by_org"
on public.prompt_provider_responses
for select
to public
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.org_id = prompt_provider_responses.org_id
  )
);

-- Helpful indexes
create index if not exists idx_ppr_prompt_run_at on public.prompt_provider_responses (prompt_id, run_at desc);
create index if not exists idx_ppr_prompt_provider_run_at on public.prompt_provider_responses (prompt_id, provider, run_at desc);
create index if not exists idx_ppr_org on public.prompt_provider_responses (org_id);

-- Convenience view: latest row per provider per prompt
create or replace view public.latest_prompt_provider_responses as
select distinct on (prompt_id, provider)
  id,
  org_id,
  prompt_id,
  provider,
  model,
  status,
  run_at,
  score,
  org_brand_present,
  org_brand_prominence,
  competitors_count,
  brands_json,
  competitors_json,
  raw_ai_response,
  raw_evidence,
  error,
  token_in,
  token_out,
  metadata
from public.prompt_provider_responses
order by prompt_id, provider, run_at desc;
