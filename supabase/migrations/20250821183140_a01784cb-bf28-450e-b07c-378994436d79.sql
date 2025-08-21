-- Add unique constraint to subscribers table and fix admin user access
-- First add unique constraint on user_id
ALTER TABLE subscribers ADD CONSTRAINT subscribers_user_id_unique UNIQUE (user_id);

-- Now manually set up admin access for abouraa.chri@gmail.com
UPDATE users 
SET role = 'owner' 
WHERE email = 'abouraa.chri@gmail.com';

UPDATE organizations 
SET subscription_tier = 'pro',
    plan_tier = 'pro'
WHERE id IN (
    SELECT org_id FROM users WHERE email = 'abouraa.chri@gmail.com'
);

-- Create or update Pro subscription record for the user
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
WHERE u.email = 'abouraa.chri@gmail.com'
ON CONFLICT (user_id) 
DO UPDATE SET
    subscription_tier = 'pro',
    subscribed = true,
    payment_collected = true,
    trial_started_at = now(),
    trial_expires_at = now() + interval '1 year',
    subscription_end = now() + interval '1 year',
    updated_at = now();