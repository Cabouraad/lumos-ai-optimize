-- Update The Software Smith org to pro tier to match their subscription
UPDATE organizations
SET plan_tier = 'pro'
WHERE id = 'd2a2aa3a-1df3-4a26-bdf2-18a819b1f6b3'
  AND plan_tier = 'starter';