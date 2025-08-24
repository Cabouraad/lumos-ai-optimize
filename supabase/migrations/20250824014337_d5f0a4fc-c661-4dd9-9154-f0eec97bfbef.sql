
-- 1) New denormalized table to capture each provider's full response and derived visibility fields
create table if not exists public.prompt_provider_responses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  provider text not null,
  model text,
  status text not null default 'success',          -- success | error | failed | etc.
  run_at timestamptz not null default now(),

  token_in integer not null default 0,
  token_out integer not null default 0,

  -- Full raw response payload from the LLM (text or JSON serialized to text)
  raw_ai_response text,
  -- Optional additional raw evidence (citations/body/etc.) if we extract it
  raw_evidence text,

  -- Visibility / classification artifacts
  brands_json jsonb not null default '[]'::jsonb,  -- array of strings or objects; flexible
  org_brand_present boolean not null default false,
  org_brand_prominence integer,                    -- 1-based position if known
  competitors_json jsonb not null default '[]'::jsonb,
  competitors_count integer not null default 0,
  score integer not null default 0,
  citations jsonb not null default '[]'::jsonb,

  -- Diagnostics and extras
  error text,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

-- 2) Indexes and uniqueness for upserts and fast reads
create index if not exists idx_ppr_prompt_provider_run_at on public.prompt_provider_responses (prompt_id, provider, run_at desc);
create index if not exists idx_ppr_org_run_at on public.prompt_provider_responses (org_id, run_at desc);
create index if not exists idx_ppr_provider on public.prompt_provider_responses (provider);
create index if not exists idx_ppr_brands_gin on public.prompt_provider_responses using gin (brands_json);
create index if not exists idx_ppr_competitors_gin on public.prompt_provider_responses using gin (competitors_json);

alter table public.prompt_provider_responses
  add constraint if not exists uniq_ppr_prompt_provider_run unique (prompt_id, provider, run_at);

-- 3) RLS: org users can read; only service role can write
alter table public.prompt_provider_responses enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'prompt_provider_responses'
      and policyname = 'ppr_select_by_org'
  ) then
    create policy "ppr_select_by_org"
      on public.prompt_provider_responses
      for select
      using (
        exists (
          select 1 from public.users u
          where u.id = auth.uid()
            and u.org_id = prompt_provider_responses.org_id
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'prompt_provider_responses'
      and policyname = 'ppr_insert_service_only'
  ) then
    create policy "ppr_insert_service_only"
      on public.prompt_provider_responses
      for insert
      with check (auth.role() = 'service_role');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'prompt_provider_responses'
      and policyname = 'ppr_update_service_only'
  ) then
    create policy "ppr_update_service_only"
      on public.prompt_provider_responses
      for update
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'prompt_provider_responses'
      and policyname = 'ppr_delete_service_only'
  ) then
    create policy "ppr_delete_service_only"
      on public.prompt_provider_responses
      for delete
      using (auth.role() = 'service_role');
  end if;
end $$;

-- 4) Helper view for the UI: latest row per (prompt, provider)
create or replace view public.latest_prompt_provider_responses as
select distinct on (prompt_id, provider)
  id, org_id, prompt_id, provider, model, status, run_at,
  token_in, token_out,
  raw_ai_response, raw_evidence,
  brands_json, org_brand_present, org_brand_prominence,
  competitors_json, competitors_count, score, citations,
  error, metadata, created_at
from public.prompt_provider_responses
order by prompt_id, provider, run_at desc;

-- 5) Optional backfill from existing tables (only inserts new rows)
insert into public.prompt_provider_responses (
  org_id,
  prompt_id,
  provider,
  model,
  status,
  run_at,
  token_in,
  token_out,
  raw_ai_response,
  raw_evidence,
  brands_json,
  org_brand_present,
  org_brand_prominence,
  competitors_json,
  competitors_count,
  score,
  citations,
  error,
  metadata
)
select
  p.org_id,
  pr.prompt_id,
  coalesce(lp.name, 'unknown') as provider,
  null::text as model,
  pr.status,
  pr.run_at,
  pr.token_in,
  pr.token_out,
  vr.raw_ai_response,
  vr.raw_evidence,
  coalesce(vr.brands_json, '[]'::jsonb),
  coalesce(vr.org_brand_present, false),
  vr.org_brand_prominence,
  coalesce(pr.competitors, '[]'::jsonb),
  coalesce(vr.competitors_count, 0),
  coalesce(vr.score, 0),
  coalesce(pr.citations, '[]'::jsonb),
  null::text as error,
  jsonb_build_object('backfilled', true)
from public.prompt_runs pr
join public.prompts p on p.id = pr.prompt_id
left join public.llm_providers lp on lp.id = pr.provider_id
left join public.visibility_results vr on vr.prompt_run_id = pr.id
on conflict on constraint uniq_ppr_prompt_provider_run do nothing;
