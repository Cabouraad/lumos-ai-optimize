-- Add unique constraint to prevent duplicate competitor exclusions
ALTER TABLE org_competitor_exclusions 
ADD CONSTRAINT org_competitor_exclusions_org_competitor_unique 
UNIQUE (org_id, competitor_name);

-- Add index for faster exclusion lookups
CREATE INDEX IF NOT EXISTS idx_org_competitor_exclusions_lookup 
ON org_competitor_exclusions(org_id, competitor_name);

-- Comment explaining the constraint
COMMENT ON CONSTRAINT org_competitor_exclusions_org_competitor_unique ON org_competitor_exclusions 
IS 'Ensures each competitor can only be excluded once per organization';