-- Reset password for admin user and ensure proper setup
DO $$
DECLARE
  admin_user_id uuid := '9f1ce7bc-3e6f-4080-800b-2f402bfd7bf5';
  admin_org_id uuid;
BEGIN
  -- Get or create organization for admin
  SELECT id INTO admin_org_id FROM organizations WHERE domain = 'admin.llumos.app' LIMIT 1;
  
  IF admin_org_id IS NULL THEN
    INSERT INTO organizations (
      name,
      domain,
      plan_tier,
      subscription_tier,
      business_description
    ) VALUES (
      'Llumos Admin',
      'admin.llumos.app',
      'pro',
      'pro',
      'Admin organization for Llumos platform'
    ) RETURNING id INTO admin_org_id;
  END IF;

  -- Ensure user exists in users table with correct org
  INSERT INTO users (
    id,
    email,
    org_id,
    role
  ) VALUES (
    admin_user_id,
    'abouraa.chri@gmail.com',
    admin_org_id,
    'owner'
  ) ON CONFLICT (id) DO UPDATE SET
    org_id = admin_org_id,
    role = 'owner';

  -- Update auth.users password using the admin API
  -- Note: This requires service role access
  UPDATE auth.users 
  SET 
    encrypted_password = crypt('Test123', gen_salt('bf')),
    email_confirmed_at = CASE 
      WHEN email_confirmed_at IS NULL THEN now() 
      ELSE email_confirmed_at 
    END,
    updated_at = now()
  WHERE id = admin_user_id;

  -- Ensure subscriber record is correct
  INSERT INTO subscribers (
    user_id,
    email,
    subscription_tier,
    subscribed,
    payment_collected,
    trial_started_at,
    trial_expires_at,
    subscription_end
  ) VALUES (
    admin_user_id,
    'abouraa.chri@gmail.com',
    'pro',
    true,
    true,
    now(),
    now() + interval '1 year',
    now() + interval '1 year'
  ) ON CONFLICT (email) DO UPDATE SET
    subscription_tier = 'pro',
    subscribed = true,
    payment_collected = true,
    trial_started_at = COALESCE(subscribers.trial_started_at, now()),
    trial_expires_at = now() + interval '1 year',
    subscription_end = now() + interval '1 year',
    updated_at = now();

  RAISE NOTICE 'Admin user setup complete for abouraa.chri@gmail.com';
END $$;