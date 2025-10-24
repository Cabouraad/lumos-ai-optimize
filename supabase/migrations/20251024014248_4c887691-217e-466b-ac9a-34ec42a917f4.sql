-- Activate trial for chris@pitstop.com who completed payment
INSERT INTO subscribers (
  user_id,
  email,
  subscription_tier,
  subscribed,
  payment_collected,
  trial_started_at,
  trial_expires_at,
  stripe_customer_id
) VALUES (
  '436b29ee-1c46-4900-b76e-41d7241a6604',
  'chris@pitstop.com',
  'starter',
  false,
  true,
  NOW(),
  NOW() + INTERVAL '7 days',
  NULL
)
ON CONFLICT (user_id) 
DO UPDATE SET
  subscription_tier = 'starter',
  subscribed = false,
  payment_collected = true,
  trial_started_at = NOW(),
  trial_expires_at = NOW() + INTERVAL '7 days',
  updated_at = NOW();