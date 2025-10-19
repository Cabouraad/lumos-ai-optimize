-- Complete reset for amir@test.com user
DO $$
DECLARE
  target_user_id uuid;
  target_org_id uuid;
BEGIN
  -- Get the user_id from auth.users
  SELECT id INTO target_user_id 
  FROM auth.users 
  WHERE email = 'amir@test.com';
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User amir@test.com not found in auth.users';
  END IF;
  
  -- Get their current org_id if they have one
  SELECT org_id INTO target_org_id
  FROM public.users
  WHERE id = target_user_id;
  
  -- If they have an organization, delete all related data
  IF target_org_id IS NOT NULL THEN
    -- Delete prompt provider responses
    DELETE FROM public.prompt_provider_responses 
    WHERE org_id = target_org_id;
    
    -- Delete prompts
    DELETE FROM public.prompts 
    WHERE org_id = target_org_id;
    
    -- Delete suggested prompts
    DELETE FROM public.suggested_prompts 
    WHERE org_id = target_org_id;
    
    -- Delete recommendations
    DELETE FROM public.recommendations 
    WHERE org_id = target_org_id;
    
    -- Delete optimizations
    DELETE FROM public.optimizations_v2 
    WHERE org_id = target_org_id;
    
    -- Delete brand catalog
    DELETE FROM public.brand_catalog 
    WHERE org_id = target_org_id;
    
    -- Delete brand candidates
    DELETE FROM public.brand_candidates 
    WHERE org_id = target_org_id;
    
    -- Delete reports
    DELETE FROM public.reports 
    WHERE org_id = target_org_id;
    
    -- Delete weekly reports
    DELETE FROM public.weekly_reports 
    WHERE org_id = target_org_id;
    
    -- Delete batch jobs
    DELETE FROM public.batch_jobs 
    WHERE org_id = target_org_id;
    
    -- Delete daily usage
    DELETE FROM public.daily_usage 
    WHERE org_id = target_org_id;
    
    -- Delete llms generations
    DELETE FROM public.llms_generations 
    WHERE org_id = target_org_id;
    
    -- Delete user_roles for this org
    DELETE FROM public.user_roles 
    WHERE org_id = target_org_id;
    
    -- Delete the organization itself
    DELETE FROM public.organizations 
    WHERE id = target_org_id;
    
    RAISE NOTICE 'Deleted organization % and all related data', target_org_id;
  END IF;
  
  -- Reset the user record (set org_id to NULL, role to member)
  UPDATE public.users
  SET 
    org_id = NULL,
    role = 'member'
  WHERE id = target_user_id;
  
  -- Delete any remaining user_roles entries
  DELETE FROM public.user_roles 
  WHERE user_id = target_user_id;
  
  -- Delete existing subscriber record if any
  DELETE FROM public.subscribers 
  WHERE user_id = target_user_id OR email = 'amir@test.com';
  
  -- Create new subscriber record with 12-month Pro subscription
  INSERT INTO public.subscribers (
    user_id,
    email,
    subscribed,
    subscription_tier,
    subscription_end,
    trial_expires_at,
    trial_started_at,
    payment_collected,
    metadata
  ) VALUES (
    target_user_id,
    'amir@test.com',
    true,
    'pro',
    now() + interval '12 months',
    NULL,
    NULL,
    true,
    jsonb_build_object(
      'reset_at', now(),
      'subscription_duration', '12 months',
      'subscription_type', 'pro'
    )
  );
  
  RAISE NOTICE 'Successfully reset user amir@test.com with 12-month Pro subscription';
END $$;