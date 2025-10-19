-- Grant Pro subscription to amir@test.app for 12 months
-- First, get the user_id for amir@test.app
DO $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Get the user_id from auth.users
  SELECT id INTO target_user_id 
  FROM auth.users 
  WHERE email = 'amir@test.app';
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User amir@test.app not found';
  END IF;
  
  -- Insert or update the subscribers table
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
    'amir@test.app',
    true,
    'pro',
    now() + interval '12 months',
    NULL, -- No trial needed since this is a direct grant
    now(),
    false, -- No payment collected (test account)
    jsonb_build_object(
      'granted_by', 'admin',
      'grant_reason', 'test_account',
      'grant_date', now(),
      'original_subscription_end', now() + interval '12 months'
    )
  )
  ON CONFLICT (user_id) 
  DO UPDATE SET
    subscribed = true,
    subscription_tier = 'pro',
    subscription_end = now() + interval '12 months',
    payment_collected = false,
    updated_at = now(),
    metadata = COALESCE(subscribers.metadata, '{}'::jsonb) || jsonb_build_object(
      'granted_by', 'admin',
      'grant_reason', 'test_account',
      'grant_date', now(),
      'original_subscription_end', now() + interval '12 months'
    );
    
  RAISE NOTICE 'Successfully granted Pro subscription to amir@test.app until %', now() + interval '12 months';
END $$;