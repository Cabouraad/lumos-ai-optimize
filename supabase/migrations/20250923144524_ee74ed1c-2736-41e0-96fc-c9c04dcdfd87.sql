-- Organization-specific dynamic competitor detection setup
-- Clean up the previous fixed competitor approach and enable automatic syncing

-- Step 1: Remove any generic competitors that were added by the previous migration
-- We'll keep legitimate ones but remove obvious generic terms

DELETE FROM brand_catalog 
WHERE is_org_brand = false 
  AND (
    lower(trim(name)) IN ('platforms', 'specific', 'consider', 'businesses', 'needs', 'options', 'features') 
    OR name ~ '^[0-9]+$'  -- purely numeric
    OR length(trim(name)) < 3  -- too short
  );

-- Step 2: Create a function to automatically trigger competitor sync
-- This will be called periodically to keep the brand catalog up to date

CREATE OR REPLACE FUNCTION sync_competitor_detection_automated()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- This function will be called by a cron job to invoke the edge function
  -- Since we can't directly call edge functions from SQL, this is a placeholder
  -- that could be used to trigger other sync logic if needed
  
  -- Log the sync attempt
  INSERT INTO audit_events (run_id, name, phase, level, data)
  VALUES (
    gen_random_uuid(),
    'competitor_sync_automated',
    'sync',
    'info',
    jsonb_build_object(
      'trigger_time', now(),
      'type', 'automated_sync'
    )
  );
END;
$$;

-- Step 3: Update brand catalog to ensure proper indexing for performance
-- This helps with the organization-specific queries

CREATE INDEX IF NOT EXISTS idx_brand_catalog_org_brand_type 
ON brand_catalog (org_id, is_org_brand, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_brand_catalog_name_search 
ON brand_catalog (org_id, lower(trim(name))) 
WHERE is_org_brand = false;

-- Step 4: Add a constraint to prevent duplicate competitor names per org
-- This ensures data quality in the brand catalog

ALTER TABLE brand_catalog 
ADD CONSTRAINT unique_brand_per_org 
UNIQUE (org_id, name) 
DEFERRABLE INITIALLY DEFERRED;

-- Step 5: Create a view for easy competitor analytics per organization
CREATE OR REPLACE VIEW org_competitor_analytics AS
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