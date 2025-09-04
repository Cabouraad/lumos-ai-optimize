-- Create function to set up test user for starter plan
CREATE OR REPLACE FUNCTION public.setup_starter_test_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_org_id uuid;
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
    
    RAISE NOTICE 'Test user % set up with Starter plan access', NEW.email;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for the test user setup (will run after the admin trigger)
DROP TRIGGER IF EXISTS setup_starter_test_user_trigger ON auth.users;
CREATE TRIGGER setup_starter_test_user_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.setup_starter_test_user();