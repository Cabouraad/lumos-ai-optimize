-- Fix security warning by removing SECURITY DEFINER from view
-- and add proper RLS policy for the view

-- Drop and recreate the view without SECURITY DEFINER
DROP VIEW IF EXISTS org_competitor_analytics;

CREATE VIEW org_competitor_analytics AS
SELECT 
  bc.org_id,
  bc.name as competitor_name,
  bc.total_appearances,
  bc.average_score,
  bc.last_seen_at,
  bc.first_detected_at,
  -- Calculate days since last seen
  EXTRACT(DAY FROM (now() - bc.last_seen_at)) as days_since_last_seen,
  -- Calculate competitor strength score
  CASE 
    WHEN bc.total_appearances >= 10 AND bc.average_score >= 6 THEN 'strong'
    WHEN bc.total_appearances >= 5 OR bc.average_score >= 5 THEN 'moderate' 
    ELSE 'weak'
  END as competitor_strength,
  -- Recent activity indicator
  bc.last_seen_at >= (now() - interval '7 days') as recently_active
FROM brand_catalog bc
WHERE bc.is_org_brand = false
ORDER BY bc.org_id, bc.total_appearances DESC, bc.average_score DESC;