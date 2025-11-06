-- Clean up old competitors, keeping only the 50 most recent per org
DO $$
DECLARE
  org_record RECORD;
  competitors_to_delete uuid[];
BEGIN
  -- Process each org that's over the limit
  FOR org_record IN 
    SELECT org_id, COUNT(*) as competitor_count
    FROM brand_catalog
    WHERE is_org_brand = false
    GROUP BY org_id
    HAVING COUNT(*) > 50
  LOOP
    RAISE NOTICE 'Org % has % competitors, cleaning up to 50...', org_record.org_id, org_record.competitor_count;
    
    -- Get IDs of competitors to delete (keep top 50 by last_seen_at)
    SELECT array_agg(id) INTO competitors_to_delete
    FROM (
      SELECT id
      FROM brand_catalog
      WHERE org_id = org_record.org_id
        AND is_org_brand = false
      ORDER BY last_seen_at DESC NULLS LAST
      OFFSET 50
    ) old_competitors;
    
    IF array_length(competitors_to_delete, 1) > 0 THEN
      DELETE FROM brand_catalog
      WHERE id = ANY(competitors_to_delete);
      
      RAISE NOTICE 'Deleted % old competitors for org %', array_length(competitors_to_delete, 1), org_record.org_id;
    END IF;
  END LOOP;
END $$;