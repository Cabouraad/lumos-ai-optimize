-- Fix stale brand_catalog data by updating last_seen_at timestamps
-- for competitors that exist in recent prompt_provider_responses

UPDATE brand_catalog 
SET 
  last_seen_at = recent_data.max_run_at,
  total_appearances = recent_data.appearance_count,
  average_score = recent_data.avg_score
FROM (
  SELECT 
    bc.id,
    bc.name,
    bc.org_id,
    COUNT(DISTINCT ppr.id) as appearance_count,
    MAX(ppr.run_at) as max_run_at,
    AVG(
      CASE 
        WHEN jsonb_array_length(ppr.competitors_json) > 0 THEN
          (SELECT AVG((comp->>'score')::numeric) 
           FROM jsonb_array_elements(ppr.competitors_json) comp 
           WHERE lower(trim(comp->>'name')) = lower(trim(bc.name)))
        ELSE NULL
      END
    ) as avg_score
  FROM brand_catalog bc
  JOIN prompt_provider_responses ppr ON ppr.org_id = bc.org_id
  WHERE 
    bc.is_org_brand = false
    AND ppr.run_at >= (now() - interval '30 days')
    AND (
      ppr.competitors_json::text ILIKE '%' || bc.name || '%'
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(ppr.competitors_json) comp
        WHERE lower(trim(comp->>'name')) = lower(trim(bc.name))
      )
    )
  GROUP BY bc.id, bc.name, bc.org_id
  HAVING COUNT(DISTINCT ppr.id) > 0
) recent_data
WHERE brand_catalog.id = recent_data.id
  AND brand_catalog.last_seen_at < recent_data.max_run_at;