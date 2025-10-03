-- Standard visibility view (14 days) used by ALL generation paths
create or replace view public.prompt_visibility_14d
with (security_invoker = on) as
with recent_responses as (
  select 
    ppr.org_id,
    ppr.prompt_id,
    ppr.id as response_id,
    ppr.org_brand_present
  from public.prompt_provider_responses ppr
  where ppr.run_at >= now() - interval '14 days'
    and ppr.status = 'success'
),
presence_calc as (
  select 
    rr.org_id,
    rr.prompt_id,
    (sum(case when rr.org_brand_present then 1 else 0 end)::float
     / nullif(count(*), 0)::float) * 100.0 as presence_rate,
    count(distinct rr.response_id) as runs_14d
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

-- Grant access to authenticated users
revoke all on public.prompt_visibility_14d from public, anon;
grant select on public.prompt_visibility_14d to authenticated;

-- Add fingerprint column for near-duplicate prevention (idempotent)
alter table if exists public.optimizations
  add column if not exists fingerprint text;

-- Create unique index to prevent duplicates
create unique index if not exists uniq_opt_fingerprint
  on public.optimizations(org_id, prompt_id, fingerprint);

-- Add updated_at for heartbeat tracking on jobs
alter table if exists public.optimization_jobs
  add column if not exists updated_at timestamptz default now();

-- Index for efficient job queue queries
create index if not exists idx_optimization_jobs_status_updated
  on public.optimization_jobs(status, updated_at desc);

-- Add comment for documentation
comment on view public.prompt_visibility_14d is 
  'Standardized 14-day visibility view used by all optimization generation paths';