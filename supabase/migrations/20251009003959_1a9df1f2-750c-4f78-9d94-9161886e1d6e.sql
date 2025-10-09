-- Update the update_org_business_context function to clean up incompatible suggestions
-- when the enable_localized_prompts setting is changed
CREATE OR REPLACE FUNCTION public.update_org_business_context(
  p_keywords text[] DEFAULT NULL,
  p_competitors text[] DEFAULT NULL,
  p_products_services text DEFAULT NULL,
  p_target_audience text DEFAULT NULL,
  p_business_description text DEFAULT NULL,
  p_business_city text DEFAULT NULL,
  p_business_state text DEFAULT NULL,
  p_business_country text DEFAULT NULL,
  p_enable_localized_prompts boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_org_id uuid;
  old_localized_setting boolean;
BEGIN
  -- Get the authenticated user's org_id
  SELECT u.org_id INTO user_org_id
  FROM users u 
  WHERE u.id = auth.uid();
  
  -- If no org_id found, raise error
  IF user_org_id IS NULL THEN
    RAISE EXCEPTION 'User not associated with any organization';
  END IF;
  
  -- Get the current localization setting before update
  SELECT enable_localized_prompts INTO old_localized_setting
  FROM organizations
  WHERE id = user_org_id;
  
  -- Update only the provided fields (non-null parameters)
  UPDATE organizations 
  SET 
    keywords = COALESCE(p_keywords, keywords),
    competitors = COALESCE(p_competitors, competitors),
    products_services = COALESCE(p_products_services, products_services),
    target_audience = COALESCE(p_target_audience, target_audience),
    business_description = COALESCE(p_business_description, business_description),
    business_city = COALESCE(p_business_city, business_city),
    business_state = COALESCE(p_business_state, business_state),
    business_country = COALESCE(p_business_country, business_country),
    enable_localized_prompts = COALESCE(p_enable_localized_prompts, enable_localized_prompts)
  WHERE id = user_org_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found or access denied';
  END IF;
  
  -- Clean up incompatible suggestions if localization setting changed
  IF p_enable_localized_prompts IS NOT NULL AND 
     old_localized_setting IS DISTINCT FROM p_enable_localized_prompts THEN
    DELETE FROM suggested_prompts 
    WHERE org_id = user_org_id AND accepted = false;
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_org_business_context TO authenticated;