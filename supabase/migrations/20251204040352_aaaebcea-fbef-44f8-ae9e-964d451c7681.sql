-- Grant starter subscription access to user abouraa.chri@gmail.com
UPDATE subscribers 
SET 
  subscribed = true,
  subscription_tier = 'starter',
  payment_collected = true,
  updated_at = now()
WHERE user_id = '9f1ce7bc-3e6f-4080-800b-2f402bfd7bf5';