-- Clean up duplicate admin user and ensure proper setup (avoiding trigger issues)
-- Remove the inactive duplicate user record  
DELETE FROM public.users 
WHERE email = 'abouraa.chri@gmail.com' 
  AND id = '40bbcbae-65cf-43f1-8182-ff06e0b625e1'
  AND org_id IS NULL;

-- Ensure the active admin user has proper setup
UPDATE public.users 
SET role = 'owner' 
WHERE email = 'abouraa.chri@gmail.com' 
  AND id = '9f1ce7bc-3e6f-4080-800b-2f402bfd7bf5';

-- Ensure their organization has Pro tier
UPDATE public.organizations 
SET subscription_tier = 'pro', plan_tier = 'pro'
WHERE id = '4d1d9ebb-d13e-4094-99c8-e74fe8526239';