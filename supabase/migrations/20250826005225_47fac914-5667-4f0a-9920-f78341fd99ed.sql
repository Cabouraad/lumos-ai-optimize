-- Clean up broken user account for abouraa.chri@gmail.com
-- This account has org_id pointing to non-existent organization and no data

DELETE FROM users 
WHERE id = '40bbcbae-65cf-43f1-8182-ff06e0b625e1' 
AND email = 'abouraa.chri@gmail.com'
AND org_id = 'dad088ef-5282-4758-864b-d226b2d1b1fb';

-- Ensure the working admin user has proper setup
-- Update organization to ensure Pro tier
UPDATE organizations 
SET subscription_tier = 'pro', plan_tier = 'pro'
WHERE id = '4d1d9ebb-d13e-4094-99c8-e74fe8526239';

-- Ensure the admin user has proper subscription
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
    '9f1ce7bc-3e6f-4080-800b-2f402bfd7bf5',
    'abouraa.chri@gmail.com',
    'pro',
    true,
    true,
    now(),
    now() + interval '1 year',
    now() + interval '1 year'
)
ON CONFLICT (user_id) 
DO UPDATE SET
    subscription_tier = 'pro',
    subscribed = true,
    payment_collected = true,
    trial_expires_at = now() + interval '1 year',
    subscription_end = now() + interval '1 year',
    updated_at = now();

-- Also ensure proper setup for other admin email  
DO $$
BEGIN
    -- Check if amirdt22@gmail.com user exists and set up properly
    IF EXISTS (SELECT 1 FROM users WHERE email = 'amirdt22@gmail.com') THEN
        UPDATE users SET role = 'owner' WHERE email = 'amirdt22@gmail.com';
        
        -- Set up subscription for amirdt22@gmail.com if exists
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
            'pro',
            true,
            true, 
            now(),
            now() + interval '1 year',
            now() + interval '1 year'
        FROM users u 
        WHERE u.email = 'amirdt22@gmail.com'
        ON CONFLICT (user_id)
        DO UPDATE SET
            subscription_tier = 'pro',
            subscribed = true,
            payment_collected = true,
            trial_expires_at = now() + interval '1 year',
            subscription_end = now() + interval '1 year',
            updated_at = now();
    END IF;
END $$;