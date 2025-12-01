
-- Assign NULL brand_id prompts to their org's primary brand
UPDATE prompts p
SET brand_id = (
  SELECT b.id FROM brands b 
  WHERE b.org_id = p.org_id AND b.is_primary = true
  LIMIT 1
)
WHERE p.brand_id IS NULL
  AND EXISTS (
    SELECT 1 FROM brands b 
    WHERE b.org_id = p.org_id AND b.is_primary = true
  );
