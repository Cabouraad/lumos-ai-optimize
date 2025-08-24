
-- 1) Ensure the admin auto-setup trigger exists on auth.users to call the existing function
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'on_auth_user_created_admin_setup'
  ) THEN
    -- Drop it first to avoid duplicates and ensure we are using the latest function body
    DROP TRIGGER on_auth_user_created_admin_setup ON auth.users;
  END IF;
END$$;

CREATE TRIGGER on_auth_user_created_admin_setup
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.setup_admin_user();

-- 2) One-time elevation for the existing user abouraa.chri@gmail.com
DO $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
  v_email text := 'abouraa.chri@gmail.com';
BEGIN
  -- Find the user in auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User % not found in auth.users. Skipping elevation.', v_email;
    RETURN;
  END IF;

  -- Ensure a row exists in public.users and set role=owner
  UPDATE public.users
  SET role = 'owner'
  WHERE id = v_user_id;

  -- Fetch their org_id
  SELECT org_id INTO v_org_id
  FROM public.users
  WHERE id = v_user_id;

  IF v_org_id IS NULL THEN
    RAISE NOTICE 'User % has no org_id in public.users; cannot set org to Pro.', v_email;
  ELSE
    -- Set organization to Pro
    UPDATE public.organizations
    SET plan_tier = 'pro',
        subscription_tier = 'pro'
    WHERE id = v_org_id;
  END IF;

  -- Upsert a Pro subscription so the account is treated as fully subscribed
  INSERT INTO public.subscribers (
    user_id,
    email,
    subscription_tier,
    subscribed,
    payment_collected,
    trial_started_at,
    trial_expires_at,
    subscription_end,
    updated_at
  ) VALUES (
    v_user_id,
    v_email,
    'pro',
    true,
    true,
    now(),
    now() + interval '1 year',
    now() + interval '1 year',
    now()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    email = EXCLUDED.email,
    subscription_tier = 'pro',
    subscribed = true,
    payment_collected = true,
    -- Keep existing trial dates if set, else use the new ones
    trial_started_at = COALESCE(public.subscribers.trial_started_at, EXCLUDED.trial_started_at),
    trial_expires_at = COALESCE(public.subscribers.trial_expires_at, EXCLUDED.trial_expires_at),
    subscription_end = COALESCE(public.subscribers.subscription_end, EXCLUDED.subscription_end),
    updated_at = now();

  RAISE NOTICE 'User % elevated to owner with Pro subscription.', v_email;
END$$;
