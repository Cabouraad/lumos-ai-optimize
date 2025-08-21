-- Add unique constraint to subscribers table and fix admin user access
-- First add unique constraint on user_id (if not exists)
ALTER TABLE subscribers ADD CONSTRAINT IF NOT EXISTS subscribers_user_id_unique UNIQUE (user_id);

-- Update the existing subscriber record for abouraa.chri@gmail.com
UPDATE subscribers 
SET 
    subscription_tier = 'pro',
    subscribed = true,
    payment_collected = true,
    trial_started_at = now(),
    trial_expires_at = now() + interval '1 year',
    subscription_end = now() + interval '1 year',
    updated_at = now()
WHERE email = 'abouraa.chri@gmail.com';

-- Also ensure the user has owner role and org has pro tier
UPDATE users 
SET role = 'owner' 
WHERE email = 'abouraa.chri@gmail.com';

UPDATE organizations 
SET subscription_tier = 'pro',
    plan_tier = 'pro'
WHERE id IN (
    SELECT org_id FROM users WHERE email = 'abouraa.chri@gmail.com'
);