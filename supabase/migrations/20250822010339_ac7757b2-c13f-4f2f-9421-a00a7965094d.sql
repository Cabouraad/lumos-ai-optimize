-- Update the setup_admin_user function to include both admin emails
CREATE OR REPLACE FUNCTION public.setup_admin_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if this is one of the admin emails
  IF NEW.email IN ('abouraa.chri@gmail.com', 'amirdt22@gmail.com') THEN
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
$function$