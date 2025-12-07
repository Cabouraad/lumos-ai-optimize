-- Create a lightweight function specifically for brand card stats
-- This avoids the heavy get_unified_dashboard_data and fetches only what's needed
CREATE OR REPLACE FUNCTION public.get_brand_card_stats(p_org_id uuid, p_brand_ids uuid[])
RETURNS TABLE (
  brand_id uuid,
  prompt_count bigint,
  brand_presence_rate numeric,
  visibility_score numeric,
  total_responses bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH brand_prompts AS (
    SELECT 
      p.brand_id,
      COUNT(*) as prompt_cnt
    FROM prompts p
    WHERE p.org_id = p_org_id
      AND p.active = true
      AND p.brand_id = ANY(p_brand_ids)
    GROUP BY p.brand_id
  ),
  brand_responses AS (
    SELECT 
      p.brand_id,
      COUNT(*) as total_resp,
      SUM(CASE WHEN ppr.org_brand_present = true THEN 1 ELSE 0 END) as brand_present_cnt,
      ROUND(AVG(ppr.score)::numeric, 1) as avg_score
    FROM prompts p
    INNER JOIN prompt_provider_responses ppr ON ppr.prompt_id = p.id
    WHERE p.org_id = p_org_id
      AND p.brand_id = ANY(p_brand_ids)
      AND ppr.status IN ('success', 'completed')
      AND ppr.run_at >= NOW() - INTERVAL '14 days'
    GROUP BY p.brand_id
  )
  SELECT 
    b.id as brand_id,
    COALESCE(bp.prompt_cnt, 0) as prompt_count,
    CASE 
      WHEN COALESCE(br.total_resp, 0) > 0 
      THEN ROUND((br.brand_present_cnt::numeric / br.total_resp::numeric) * 100, 1)
      ELSE 0 
    END as brand_presence_rate,
    COALESCE(br.avg_score, 0) as visibility_score,
    COALESCE(br.total_resp, 0) as total_responses
  FROM brands b
  LEFT JOIN brand_prompts bp ON bp.brand_id = b.id
  LEFT JOIN brand_responses br ON br.brand_id = b.id
  WHERE b.org_id = p_org_id
    AND b.id = ANY(p_brand_ids);
END;
$$;

-- Add index to speed up the brand_id lookups if not exists
CREATE INDEX IF NOT EXISTS idx_prompts_brand_id_active ON prompts(brand_id, active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_ppr_prompt_id_status_run_at ON prompt_provider_responses(prompt_id, status, run_at) WHERE status IN ('success', 'completed');