-- Fix test user subscription access for abouraa.chri@gmail.com
-- Update or insert Pro subscription for all users with this email

-- First, ensure both user records have Pro subscriptions
INSERT INTO subscribers (
    user_id,
    email,
    subscription_tier,
    subscribed,
    payment_collected,
    trial_started_at,
    trial_expires_at,
    subscription_end,
    stripe_customer_id,
    updated_at
) 
SELECT 
    u.id,
    u.email,
    'pro',
    true,
    true,
    now(),
    now() + interval '1 year',
    now() + interval '1 year',
    'admin_override_' || u.id::text,
    now()
FROM users u
WHERE u.email = 'abouraa.chri@gmail.com'
ON CONFLICT (user_id) 
DO UPDATE SET
    subscription_tier = 'pro',
    subscribed = true,
    payment_collected = true,
    trial_started_at = COALESCE(subscribers.trial_started_at, now()),
    trial_expires_at = now() + interval '1 year',
    subscription_end = now() + interval '1 year',
    stripe_customer_id = COALESCE(subscribers.stripe_customer_id, 'admin_override_' || subscribers.user_id::text),
    updated_at = now();

-- Also ensure user has owner role
UPDATE users 
SET role = 'owner'
WHERE email = 'abouraa.chri@gmail.com';

-- Update their organization to Pro tier as well
UPDATE organizations 
SET 
    subscription_tier = 'pro',
    plan_tier = 'pro'
WHERE id IN (
    SELECT org_id 
    FROM users 
    WHERE email = 'abouraa.chri@gmail.com'
);