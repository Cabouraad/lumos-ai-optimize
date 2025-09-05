-- Grant Starter access to starter@test.app WITHOUT billing
-- Updated to match actual database schema
DO $$
DECLARE
  v_user_id uuid;
  v_org_id  uuid;
BEGIN
  -- 1) Find the user
  SELECT id
  INTO v_user_id
  FROM auth.users
  WHERE LOWER(email) = LOWER('starter@test.app');

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User % not found in auth.users', 'starter@test.app';
  END IF;

  -- 2) Find or create org membership for this user
  SELECT u.org_id
  INTO v_org_id
  FROM public.users u
  WHERE u.id = v_user_id;

  IF v_org_id IS NULL THEN
    -- Create organization
    INSERT INTO public.organizations (name, domain, plan_tier, created_at)
    VALUES ('Starter Test Org', 'test.app', 'starter', now())
    RETURNING id INTO v_org_id;

    -- Create user record with org membership
    INSERT INTO public.users (id, org_id, email, role, created_at)
    VALUES (v_user_id, v_org_id, 'starter@test.app', 'owner', now())
    ON CONFLICT (id) DO UPDATE 
    SET org_id = EXCLUDED.org_id, 
        role = EXCLUDED.role;
  END IF;

  -- 3) Upsert Starter subscription (12-month window, payment_collected=true)
  INSERT INTO public.subscribers (
      user_id,
      email, 
      subscription_tier,
      subscribed,
      payment_collected,
      trial_expires_at,
      subscription_end,
      created_at,
      updated_at,
      metadata
  )
  VALUES (
      v_user_id,
      'starter@test.app',
      'starter',
      true,
      true,
      NULL,
      now() + interval '12 months',
      now(),
      now(),
      jsonb_build_object('source', 'manual_bypass', 'set_at', now())
  )
  ON CONFLICT (email) DO UPDATE
  SET subscription_tier = 'starter',
      subscribed = true,
      payment_collected = true,
      trial_expires_at = NULL,
      subscription_end = now() + interval '12 months',
      updated_at = now(),
      metadata = COALESCE(subscribers.metadata, '{}'::jsonb) 
                 || jsonb_build_object('source', 'manual_bypass', 'set_at', now());

  RAISE NOTICE 'Successfully granted Starter access to starter@test.app';
END $$;