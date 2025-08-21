-- Fix admin user access for abouraa.chri@gmail.com
-- First check if constraint exists, if not add it
DO $$
BEGIN
    -- Add unique constraint on user_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'subscribers_user_id_unique') THEN
        ALTER TABLE subscribers ADD CONSTRAINT subscribers_user_id_unique UNIQUE (user_id);
    END IF;
END $$;

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