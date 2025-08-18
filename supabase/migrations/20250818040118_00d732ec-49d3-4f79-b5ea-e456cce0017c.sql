-- Create a test function to verify the reco_upsert fix
CREATE OR REPLACE FUNCTION public.test_reco_insert(
  p_org_id uuid,
  p_test_title text DEFAULT 'TEST RECOMMENDATION'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER  
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
$function$