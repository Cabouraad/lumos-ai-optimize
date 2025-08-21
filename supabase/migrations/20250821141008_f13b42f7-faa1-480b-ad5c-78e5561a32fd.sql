-- Grant admin access and Pro subscription to test user
DO $$
DECLARE
    target_email TEXT := 'abouraa.chri@gmail.com';
    target_user_id UUID;
    target_org_id UUID;
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
    
    -- Insert/update subscriber record for Pro access without Stripe
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
        now() + interval '1 year', -- Long trial period
        now() + interval '1 year'  -- Subscription valid for 1 year
    )
    ON CONFLICT (user_id) DO UPDATE SET
        subscription_tier = 'pro',
        subscribed = true,
        payment_collected = true,
        trial_started_at = COALESCE(subscribers.trial_started_at, now()),
        trial_expires_at = now() + interval '1 year',
        subscription_end = now() + interval '1 year',
        updated_at = now();
    
    RAISE NOTICE 'Successfully granted admin access and Pro subscription to %', target_email;
END $$;