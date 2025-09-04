-- Update the starter test user function to handle multiple test emails
CREATE OR REPLACE FUNCTION public.setup_starter_test_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_org_id uuid;
  org_name text;
  org_domain text;
BEGIN
  -- Check if this is one of the starter test user emails
  IF NEW.email IN ('chris@pitstopgas.net', 'Starter@test.app') THEN
    
    -- Set organization details based on email
    IF NEW.email = 'chris@pitstopgas.net' THEN
      org_name := 'PitStop Gas Station';
      org_domain := 'pitstopgas.net';
    ELSIF NEW.email = 'Starter@test.app' THEN
      org_name := 'Starter Test Organization';
      org_domain := 'test.app';
    END IF;
    
    -- Create organization for test user
    INSERT INTO organizations (
      name,
      domain,
      plan_tier,
      subscription_tier,
      business_description,
      verified_at
    ) VALUES (
      org_name,
      org_domain,
      'starter',
      'starter',
      'Test organization for starter plan functionality',
      now()
    ) RETURNING id INTO new_org_id;
    
    -- Update user record with org_id and role
    UPDATE users 
    SET 
      org_id = new_org_id,
      role = 'owner'
    WHERE id = NEW.id;
    
    -- Create starter subscription record for testing
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
        NEW.id,
        NEW.email,
        'starter',
        true,
        false, -- No payment required for testing
        now(),
        now() + interval '30 days', -- 30 day test period
        now() + interval '30 days'
    );
    
    RAISE NOTICE 'Starter test user % set up with Starter plan access (org: %)', NEW.email, org_name;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Also manually set up the existing user if they already exist in auth but not in our tables
DO $$
DECLARE
    auth_user_id uuid;
    new_org_id uuid;
BEGIN
    -- Check if user exists in auth.users by querying for the email pattern
    -- Note: We can't directly query auth.users, so this will run when the user signs up
    
    -- If the user already exists in our users table, update their setup
    IF EXISTS (SELECT 1 FROM users WHERE email = 'Starter@test.app') THEN
        -- Get or create organization
        SELECT id INTO new_org_id FROM organizations WHERE domain = 'test.app';
        
        IF NOT FOUND THEN
            INSERT INTO organizations (
                name,
                domain,
                plan_tier,
                subscription_tier,
                business_description,
                verified_at
            ) VALUES (
                'Starter Test Organization',
                'test.app',
                'starter',
                'starter',
                'Test organization for starter plan functionality',
                now()
            ) RETURNING id INTO new_org_id;
        END IF;
        
        -- Update user with org_id if not already set
        UPDATE users 
        SET 
            org_id = COALESCE(org_id, new_org_id),
            role = COALESCE(role, 'owner')
        WHERE email = 'Starter@test.app' AND org_id IS NULL;
        
        -- Upsert subscription record
        INSERT INTO subscribers (
            user_id,
            email,
            subscription_tier,
            subscribed,
            payment_collected,
            trial_started_at,
            trial_expires_at,
            subscription_end
        ) 
        SELECT 
            u.id,
            u.email,
            'starter',
            true,
            false,
            now(),
            now() + interval '30 days',
            now() + interval '30 days'
        FROM users u 
        WHERE u.email = 'Starter@test.app'
        ON CONFLICT (email) 
        DO UPDATE SET
            subscription_tier = 'starter',
            subscribed = true,
            payment_collected = false,
            trial_started_at = now(),
            trial_expires_at = now() + interval '30 days',
            subscription_end = now() + interval '30 days',
            updated_at = now();
            
        RAISE NOTICE 'Updated existing user Starter@test.app with starter plan access';
    END IF;
END $$;