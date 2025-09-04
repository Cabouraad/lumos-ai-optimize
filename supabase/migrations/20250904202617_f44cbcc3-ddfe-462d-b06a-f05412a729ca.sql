-- Create function to set up test user for starter plan
CREATE OR REPLACE FUNCTION public.setup_starter_test_user()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if this is the test user email
  IF NEW.email = 'chris@pitstopgas.net' THEN
    -- Create organization for test user
    INSERT INTO organizations (
      name,
      domain,
      plan_tier,
      subscription_tier,
      business_description,
      verified_at
    ) VALUES (
      'PitStop Gas Station',
      'pitstopgas.net',
      'starter',
      'starter',
      'Gas station and convenience store chain',
      now()
    );
    
    -- Update user record with org_id and role
    UPDATE users 
    SET 
      org_id = (SELECT id FROM organizations WHERE domain = 'pitstopgas.net'),
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
    )
    ON CONFLICT (email) 
    DO UPDATE SET
        user_id = EXCLUDED.user_id,
        subscription_tier = EXCLUDED.subscription_tier,
        subscribed = EXCLUDED.subscribed,
        payment_collected = EXCLUDED.payment_collected,
        trial_started_at = EXCLUDED.trial_started_at,
        trial_expires_at = EXCLUDED.trial_expires_at,
        subscription_end = EXCLUDED.subscription_end,
        updated_at = now();
    
    RAISE NOTICE 'Test user % set up with Starter plan access', NEW.email;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for the test user setup (will run after the admin trigger)
CREATE OR REPLACE TRIGGER setup_starter_test_user_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.setup_starter_test_user();

-- Insert the test user account directly (since we can't create auth users via migration)
-- Note: The actual user creation needs to be done through the signup flow
INSERT INTO public.users (
    id,
    email,
    role,
    org_id
) VALUES (
    gen_random_uuid(),
    'chris@pitstopgas.net',
    'owner',
    null  -- Will be updated by the trigger
) ON CONFLICT (email) DO NOTHING;