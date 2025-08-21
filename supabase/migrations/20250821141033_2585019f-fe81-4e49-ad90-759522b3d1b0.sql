-- Grant admin access and Pro subscription to test user (fixed version)
DO $$
DECLARE
    target_email TEXT := 'abouraa.chri@gmail.com';
    target_user_id UUID;
    target_org_id UUID;
    existing_subscriber_id UUID;
BEGIN
    -- Find the user by email
    SELECT u.id, u.org_id INTO target_user_id, target_org_id
    FROM users u 
    WHERE u.email = target_email;
    
    IF target_user_id IS NULL THEN
        RAISE NOTICE 'User % not found - they need to sign up first', target_email;
        RETURN;
    END IF;
    
    -- Update user role to owner (admin)
    UPDATE users 
    SET role = 'owner' 
    WHERE id = target_user_id;
    
    -- Update organization subscription tier to pro
    UPDATE organizations 
    SET subscription_tier = 'pro',
        plan_tier = 'pro'
    WHERE id = target_org_id;
    
    -- Check if subscriber record exists
    SELECT id INTO existing_subscriber_id
    FROM subscribers 
    WHERE user_id = target_user_id OR email = target_email
    LIMIT 1;
    
    IF existing_subscriber_id IS NOT NULL THEN
        -- Update existing subscriber record
        UPDATE subscribers 
        SET user_id = target_user_id,
            email = target_email,
            subscription_tier = 'pro',
            subscribed = true,
            payment_collected = true,
            trial_started_at = COALESCE(trial_started_at, now()),
            trial_expires_at = now() + interval '1 year',
            subscription_end = now() + interval '1 year',
            updated_at = now()
        WHERE id = existing_subscriber_id;
    ELSE
        -- Insert new subscriber record
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
            target_user_id,
            target_email,
            'pro',
            true,
            true,
            now(),
            now() + interval '1 year',
            now() + interval '1 year'
        );
    END IF;
    
    RAISE NOTICE 'Successfully granted admin access and Pro subscription to %', target_email;
END $$;