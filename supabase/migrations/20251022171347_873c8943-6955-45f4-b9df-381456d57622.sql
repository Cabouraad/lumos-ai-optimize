-- Grant 12 months of Pro access to aj@dix.com
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
  '728e3332-e964-4560-9b8d-788f92862d84',
  'aj@dix.com',
  'pro',
  true,
  true,
  NOW(),
  NOW() + INTERVAL '12 months',
  NOW() + INTERVAL '12 months'
)
ON CONFLICT (user_id) 
DO UPDATE SET
  subscription_tier = 'pro',
  subscribed = true,
  payment_collected = true,
  trial_started_at = NOW(),
  trial_expires_at = NOW() + INTERVAL '12 months',
  subscription_end = NOW() + INTERVAL '12 months',
  updated_at = NOW();