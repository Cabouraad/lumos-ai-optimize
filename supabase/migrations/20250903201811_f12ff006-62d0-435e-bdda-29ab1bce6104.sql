-- Update the existing subscriber record to extend Pro access and ensure it's current
UPDATE subscribers 
SET 
    subscribed = true,
    subscription_tier = 'pro',
    payment_collected = true,
    trial_expires_at = now() + interval '1 year',
    subscription_end = now() + interval '1 year',
    updated_at = now()
WHERE email = 'abouraa.chri@gmail.com';

-- Ensure both users with this email have owner role
UPDATE users 
SET role = 'owner'
WHERE email = 'abouraa.chri@gmail.com';

-- Update organizations for both users to Pro tier
UPDATE organizations 
SET 
    subscription_tier = 'pro',
    plan_tier = 'pro'
WHERE id IN (
    SELECT org_id 
    FROM users 
    WHERE email = 'abouraa.chri@gmail.com'
);

-- Also create a backup subscriber record for the other user if needed
-- (using ON CONFLICT to avoid duplicate key error)
INSERT INTO subscribers (
    user_id,
    email,
    subscription_tier,
    subscribed,
    payment_collected,
    trial_started_at,
    trial_expires_at,
    subscription_end,
    updated_at
)
SELECT 
    u.id,
    'abouraa.chri+backup@gmail.com', -- Use slightly different email to avoid constraint
    'pro',
    true,
    true,
    now(),
    now() + interval '1 year',
    now() + interval '1 year',
    now()
FROM users u 
WHERE u.email = 'abouraa.chri@gmail.com' 
  AND u.id != (SELECT user_id FROM subscribers WHERE email = 'abouraa.chri@gmail.com')
ON CONFLICT (email) DO NOTHING;