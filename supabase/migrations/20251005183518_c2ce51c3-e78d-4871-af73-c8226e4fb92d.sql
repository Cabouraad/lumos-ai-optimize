-- Keep helpful indexes (no-ops if they already exist)
create index if not exists idx_ppr_org_runat on public.prompt_provider_responses (org_id, run_at desc);
create index if not exists idx_ppr_org_prompt on public.prompt_provider_responses (org_id, prompt_id);
create index if not exists idx_bc_org_lowername on public.brand_catalog (org_id, lower(name));

-- Replace RPC with a version that QUALIFIES every column reference.
drop function if exists public.get_org_competitor_summary_v2(uuid,int,int,int,text[]) cascade;

create or replace function public.get_org_competitor_summary_v2(
  p_org_id uuid default null,
  p_days   int  default 30,
  p_limit  int  default 50,
  p_offset int  default 0,
  p_providers text[] default null
)
returns table(
  competitor_name text,
  total_mentions  integer,
  distinct_prompts integer,
  first_seen      timestamptz,
  last_seen       timestamptz,
  avg_score       numeric,
  share_pct       numeric,
  trend_score     numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_days int := coalesce(p_days, 30);
  v_limit int := least(coalesce(p_limit, 50), 50);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
begin
  -- Resolve caller's org
  select u.org_id into v_org
  from public.users u
  where u.id = auth.uid();

  if v_org is null then
    raise exception 'Access denied: user has no org' using errcode = '28000';
  end if;

  if p_org_id is not null and p_org_id <> v_org then
    raise exception 'Access denied: org mismatch' using errcode = '28000';
  end if;

  v_org := coalesce(p_org_id, v_org);

  -- Extract and aggregate competitor data with optional provider filtering
  return query
  with competitor_mentions as (
    select 
      jsonb_array_elements_text(ppr.competitors_json) as competitor,
      ppr.prompt_id,
      ppr.provider,
      ppr.run_at,
      ppr.score
    from prompt_provider_responses ppr
    where ppr.org_id = v_org
      and ppr.status = 'success'
      and ppr.run_at >= (now() - (v_days || ' days')::interval)
      and jsonb_array_length(ppr.competitors_json) > 0
      and (p_providers is null or ppr.provider = any(p_providers))
  ),
  catalog_filtered as (
    select 
      bc.name as competitor_name,
      cm.prompt_id,
      cm.run_at,
      cm.score
    from competitor_mentions cm
    join brand_catalog bc on (
      bc.org_id = v_org
      and bc.is_org_brand = false
      and lower(trim(bc.name)) = lower(trim(cm.competitor))
    )
    where trim(cm.competitor) != ''
      and length(trim(cm.competitor)) >= 3
  ),
  aggregated as (
    select
      cf.competitor_name                    as competitor_name,
      count(*)::int                         as total_mentions,
      count(distinct cf.prompt_id)::int     as distinct_prompts,
      min(cf.run_at)                        as first_seen,
      max(cf.run_at)                        as last_seen,
      avg(cf.score)::numeric(10,2)          as avg_score
    from catalog_filtered cf
    group by cf.competitor_name
  ),
  totals as (
    select coalesce(sum(agg.total_mentions), 0)::numeric as all_mentions 
    from aggregated agg
  ),
  with_trend as (
    select
      cf.competitor_name as competitor_name,
      -- Trend: weight recent mentions (last 7d) 3x vs older
      (sum(case when cf.run_at >= now() - interval '7 days' then 3 else 1 end))::numeric
        / greatest(extract(epoch from (now() - min(cf.run_at))) / 86400.0, 1) as trend_score
    from catalog_filtered cf
    group by cf.competitor_name
  )
  select
    agg.competitor_name                                     as competitor_name,
    agg.total_mentions                                      as total_mentions,
    agg.distinct_prompts                                    as distinct_prompts,
    agg.first_seen                                          as first_seen,
    agg.last_seen                                           as last_seen,
    agg.avg_score                                           as avg_score,
    -- Share percentage
    case 
      when tot.all_mentions > 0 
      then round((agg.total_mentions::numeric / tot.all_mentions) * 100.0, 1)
      else 0 
    end                                                     as share_pct,
    -- Trend score (normalized)
    coalesce(round(wt.trend_score, 2), 0)::numeric          as trend_score
  from aggregated agg
  cross join totals tot
  left join with_trend wt on wt.competitor_name = agg.competitor_name
  where agg.total_mentions > 0
  order by agg.total_mentions desc, agg.last_seen desc
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.get_org_competitor_summary_v2(uuid,int,int,int,text[]) from public;
grant execute on function public.get_org_competitor_summary_v2(uuid,int,int,int,text[]) to authenticated;