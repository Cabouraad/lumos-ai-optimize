-- Phase 1: Database Foundation - Optimizations Reliability Enhancements
-- Add logs_json column for detailed job execution tracking
alter table public.optimization_generation_jobs 
add column if not exists logs_json jsonb default '[]'::jsonb;

-- Create composite index for fast MV filtering
create index if not exists idx_mv_lvp_org_presence_last 
on public.mv_low_visibility_prompts (org_id, presence_rate, last_checked_at desc);

-- Create prompt_id index for efficient lookups
create index if not exists idx_mv_lvp_prompt 
on public.mv_low_visibility_prompts (prompt_id);

-- Create SECURITY DEFINER function to refresh MV before reads (org-agnostic)
drop function if exists public.refresh_low_visibility_view() cascade;

create or replace function public.refresh_low_visibility_view()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Refresh materialized view; use non-concurrent for simplicity and compatibility
  -- This ensures the MV has current data before selection
  refresh materialized view public.mv_low_visibility_prompts;
exception when others then
  -- Don't explode the request if refresh fails; just log
  raise notice 'MV refresh failed: %', sqlerrm;
end;
$$;

-- Grant execute permissions
revoke all on function public.refresh_low_visibility_view() from public;
grant execute on function public.refresh_low_visibility_view() to authenticated, service_role;

comment on function public.refresh_low_visibility_view() is 
'Refreshes the low visibility prompts materialized view before reads. Safe to call frequently - handles errors gracefully.';