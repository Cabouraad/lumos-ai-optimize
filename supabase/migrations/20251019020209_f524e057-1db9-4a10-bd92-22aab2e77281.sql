-- Set up organization and user linkage for amir@test.com
DO $$
DECLARE
  target_user_id uuid;
  new_org_id uuid;
  user_email_domain text;
BEGIN
  -- Get the user_id
  SELECT id INTO target_user_id 
  FROM auth.users 
  WHERE email = 'amir@test.com';
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User amir@test.com not found';
  END IF;
  
  -- Extract domain from email
  user_email_domain := split_part('amir@test.com', '@', 2);
  
  -- Create organization
  INSERT INTO public.organizations (
    name,
    domain,
    plan_tier,
    subscription_tier,
    business_description,
    created_at,
    updated_at
  ) VALUES (
    'Test Organization',
    user_email_domain,
    'pro',
    'pro',
    'Test organization for onboarding',
    now(),
    now()
  )
  RETURNING id INTO new_org_id;
  
  -- Update user with org_id and role
  UPDATE public.users
  SET 
    org_id = new_org_id,
    role = 'owner'
  WHERE id = target_user_id;
  
  -- Create user_role entry
  INSERT INTO public.user_roles (
    user_id,
    org_id,
    role,
    granted_by,
    granted_at
  ) VALUES (
    target_user_id,
    new_org_id,
    'owner',
    target_user_id,
    now()
  )
  ON CONFLICT (user_id, org_id, role) DO NOTHING;
  
  RAISE NOTICE 'Successfully set up organization % for user amir@test.com', new_org_id;
END $$;