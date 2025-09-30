-- Create ai_visibility_recommendations table (additive, no breaking changes)
create table if not exists public.ai_visibility_recommendations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  channel text not null check (channel in ('content','social')),
  subtype text not null,
  title text not null,
  outline jsonb,
  posting_instructions text,
  must_include jsonb,
  where_to_publish jsonb,
  citations_used jsonb,
  success_metrics jsonb,
  score_before numeric,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_recs_org_prompt on public.ai_visibility_recommendations(org_id, prompt_id, created_at desc);

-- Enable RLS
alter table public.ai_visibility_recommendations enable row level security;

-- RLS Policies
create policy "ai_recs_select" on public.ai_visibility_recommendations
for select to authenticated using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.org_id = ai_visibility_recommendations.org_id)
);

create policy "ai_recs_insert" on public.ai_visibility_recommendations
for insert to authenticated with check (
  exists (select 1 from public.users u where u.id = auth.uid() and u.org_id = org_id)
);

-- Create prompt_visibility_14d view using existing tables
create or replace view public.prompt_visibility_14d as
with recent_responses as (
  select 
    ppr.org_id,
    ppr.prompt_id,
    ppr.org_brand_present,
    ppr.run_at
  from public.prompt_provider_responses ppr
  where ppr.run_at >= now() - interval '14 days'
    and ppr.status = 'success'
),
presence_calc as (
  select
    rr.org_id,
    rr.prompt_id,
    (sum(case when rr.org_brand_present then 1 else 0 end)::float / nullif(count(*), 0)::float) * 100.0 as presence_rate,
    count(*) as runs_14d
  from recent_responses rr
  group by rr.org_id, rr.prompt_id
)
select
  p.org_id,
  p.id as prompt_id,
  p.text as prompt_text,
  coalesce(pc.presence_rate, 0.0) as presence_rate,
  coalesce(pc.runs_14d, 0) as runs_14d
from public.prompts p
left join presence_calc pc on pc.org_id = p.org_id and pc.prompt_id = p.id
where p.active = true;