-- Upgrade user abouraa.chri@gmail.com to Pro subscription
UPDATE subscribers 
SET 
  subscription_tier = 'pro',
  updated_at = now()
WHERE user_id = '9f1ce7bc-3e6f-4080-800b-2f402bfd7bf5';