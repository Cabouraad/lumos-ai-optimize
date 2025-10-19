-- Link amir@test.com to existing test.com organization
DO $$
DECLARE
  target_user_id uuid;
  existing_org_id uuid;
BEGIN
  -- Get the user_id
  SELECT id INTO target_user_id 
  FROM auth.users 
  WHERE email = 'amir@test.com';
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User amir@test.com not found';
  END IF;
  
  -- Get the existing organization with test.com domain
  SELECT id INTO existing_org_id
  FROM public.organizations
  WHERE domain = 'test.com';
  
  IF existing_org_id IS NULL THEN
    RAISE EXCEPTION 'Organization with domain test.com not found';
  END IF;
  
  -- Update user with org_id
  UPDATE public.users
  SET 
    org_id = existing_org_id,
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
    existing_org_id,
    'owner',
    target_user_id,
    now()
  )
  ON CONFLICT (user_id, org_id, role) DO NOTHING;
  
  RAISE NOTICE 'Successfully linked user amir@test.com to organization %', existing_org_id;
END $$;