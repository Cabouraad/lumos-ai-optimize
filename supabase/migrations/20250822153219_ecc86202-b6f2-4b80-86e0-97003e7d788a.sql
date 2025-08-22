-- Convert remaining data-returning functions to SECURITY INVOKER where possible
-- Focus on functions that return data and don't strictly need elevated privileges

-- Convert test_reco_insert to SECURITY INVOKER (it's just a test function)
CREATE OR REPLACE FUNCTION public.test_reco_insert(p_org_id uuid, p_test_title text DEFAULT 'TEST RECOMMENDATION'::text)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER  -- Changed from SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO recommendations (
    org_id,
    type, 
    title,
    rationale,
    status,
    metadata
  ) VALUES (
    p_org_id,
    'content',
    p_test_title,
    'This is a test recommendation to validate database access',
    'open',
    '{"test": true}'::jsonb
  );
  
  RETURN 'SUCCESS: Test recommendation inserted';
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN 'ERROR: ' || SQLERRM;
END;
$function$;

-- Keep the following as SECURITY DEFINER because they genuinely need elevated privileges:
-- 1. All trigger functions (must have elevated privileges to work)
-- 2. Service role assertion functions (need to check auth.role())
-- 3. Admin setup functions (need elevated privileges)
-- 4. Subscriber functions (explicitly service-only)
-- 5. Complex upsert functions (need elevated privileges for multi-table operations)

-- Note: Functions like reco_upsert and upsert_competitor_* are kept as SECURITY DEFINER
-- because they perform complex multi-table operations that may need elevated privileges
-- to ensure data consistency and proper constraint enforcement.