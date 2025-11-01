-- Phase 3: Enable Citation Authority scoring for all organizations
-- After successful testing, this migration enables CA scoring globally

-- Enable CA scoring for all organizations
UPDATE public.organizations
SET enable_ca_scoring = true
WHERE enable_ca_scoring = false;

-- Create an audit log of this change
DO $$
DECLARE
  affected_count INT;
BEGIN
  SELECT COUNT(*) INTO affected_count
  FROM public.organizations
  WHERE enable_ca_scoring = true;
  
  RAISE NOTICE 'Citation Authority (CA) scoring enabled for % organization(s)', affected_count;
  RAISE NOTICE 'CA submetric will now be calculated with 20%% weight in Llumos Score';
  RAISE NOTICE 'All existing scores will be recalculated on next refresh';
END $$;