-- Create helper functions for brand candidates management
CREATE OR REPLACE FUNCTION public.get_brand_candidates_for_org()
RETURNS TABLE(
  id uuid,
  candidate_name text,
  detection_count integer,
  first_detected_at timestamp with time zone,
  last_detected_at timestamp with time zone,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_org_id uuid;
BEGIN
  -- Get the authenticated user's org_id
  SELECT u.org_id INTO user_org_id
  FROM users u 
  WHERE u.id = auth.uid();
  
  IF user_org_id IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    bc.id,
    bc.candidate_name,
    bc.detection_count,
    bc.first_detected_at,
    bc.last_detected_at,
    bc.status
  FROM brand_candidates bc
  WHERE bc.org_id = user_org_id
    AND bc.status = 'pending'
  ORDER BY bc.detection_count DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_brand_candidate(
  p_candidate_id uuid,
  p_candidate_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_org_id uuid;
  candidate_org_id uuid;
BEGIN
  -- Get the authenticated user's org_id
  SELECT u.org_id INTO user_org_id
  FROM users u 
  WHERE u.id = auth.uid();
  
  IF user_org_id IS NULL THEN
    RAISE EXCEPTION 'User not found or not authenticated';
  END IF;
  
  -- Get the candidate's org_id
  SELECT org_id INTO candidate_org_id
  FROM brand_candidates
  WHERE id = p_candidate_id;
  
  -- Security check
  IF candidate_org_id != user_org_id THEN
    RAISE EXCEPTION 'Access denied: Can only approve own organization candidates';
  END IF;
  
  -- Add to brand_catalog
  INSERT INTO brand_catalog (
    org_id,
    name,
    is_org_brand,
    variants_json,
    first_detected_at,
    last_seen_at,
    total_appearances,
    average_score
  ) VALUES (
    user_org_id,
    p_candidate_name,
    false,
    '[]'::jsonb,
    now(),
    now(),
    1,
    5.0
  )
  ON CONFLICT (org_id, name) DO NOTHING;
  
  -- Update candidate status
  UPDATE brand_candidates 
  SET 
    status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = now()
  WHERE id = p_candidate_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_brand_candidate(p_candidate_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_org_id uuid;
  candidate_org_id uuid;
BEGIN
  -- Get the authenticated user's org_id
  SELECT u.org_id INTO user_org_id
  FROM users u 
  WHERE u.id = auth.uid();
  
  IF user_org_id IS NULL THEN
    RAISE EXCEPTION 'User not found or not authenticated';
  END IF;
  
  -- Get the candidate's org_id
  SELECT org_id INTO candidate_org_id
  FROM brand_candidates
  WHERE id = p_candidate_id;
  
  -- Security check
  IF candidate_org_id != user_org_id THEN
    RAISE EXCEPTION 'Access denied: Can only reject own organization candidates';
  END IF;
  
  -- Update candidate status
  UPDATE brand_candidates 
  SET 
    status = 'rejected',
    reviewed_by = auth.uid(),
    reviewed_at = now()
  WHERE id = p_candidate_id;
END;
$$;