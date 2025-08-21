-- Create admin user setup for abouraa.chri@gmail.com when they sign up
-- This will grant them admin access and Pro subscription automatically

-- Create a function to handle new user setup
CREATE OR REPLACE FUNCTION public.setup_admin_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Check if this is the admin email
  IF NEW.email = 'abouraa.chri@gmail.com' THEN
    -- Update user role to owner
    UPDATE users 
    SET role = 'owner' 
    WHERE id = NEW.id;
    
    -- Update their organization to Pro tier
    UPDATE organizations 
    SET subscription_tier = 'pro',
        plan_tier = 'pro'
    WHERE id = (SELECT org_id FROM users WHERE id = NEW.id);
    
    -- Create Pro subscription record
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
        'pro',
        true,
        true,
        now(),
        now() + interval '1 year',
        now() + interval '1 year'
    );
    
    RAISE NOTICE 'Admin user % set up with Pro subscription', NEW.email;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to run when user record is inserted
DROP TRIGGER IF EXISTS setup_admin_user_trigger ON users;
CREATE TRIGGER setup_admin_user_trigger
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION public.setup_admin_user();