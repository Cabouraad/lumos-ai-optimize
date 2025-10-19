
-- One-time cleanup migration for amirdt22@gmail.com account
-- This deletes all data associated with user c756701f-6c51-4a06-922d-a21e27c49c83
-- and organization acea40b7-2264-4d0e-8d1f-7d30c6b01e39

-- Step 1: Delete prompt_provider_responses (358 records)
DELETE FROM prompt_provider_responses 
WHERE org_id = 'acea40b7-2264-4d0e-8d1f-7d30c6b01e39';

-- Step 2: Delete prompts (3 records)
DELETE FROM prompts 
WHERE org_id = 'acea40b7-2264-4d0e-8d1f-7d30c6b01e39';

-- Step 3: Delete brand_catalog entries (if any)
DELETE FROM brand_catalog 
WHERE org_id = 'acea40b7-2264-4d0e-8d1f-7d30c6b01e39';

-- Step 4: Delete other org-related tables
DELETE FROM recommendations WHERE org_id = 'acea40b7-2264-4d0e-8d1f-7d30c6b01e39';
DELETE FROM suggested_prompts WHERE org_id = 'acea40b7-2264-4d0e-8d1f-7d30c6b01e39';
DELETE FROM optimizations_v2 WHERE org_id = 'acea40b7-2264-4d0e-8d1f-7d30c6b01e39';
DELETE FROM brand_candidates WHERE org_id = 'acea40b7-2264-4d0e-8d1f-7d30c6b01e39';
DELETE FROM daily_usage WHERE org_id = 'acea40b7-2264-4d0e-8d1f-7d30c6b01e39';
DELETE FROM reports WHERE org_id = 'acea40b7-2264-4d0e-8d1f-7d30c6b01e39';
DELETE FROM weekly_reports WHERE org_id = 'acea40b7-2264-4d0e-8d1f-7d30c6b01e39';
DELETE FROM batch_jobs WHERE org_id = 'acea40b7-2264-4d0e-8d1f-7d30c6b01e39';
DELETE FROM llms_generations WHERE org_id = 'acea40b7-2264-4d0e-8d1f-7d30c6b01e39';

-- Step 5: Delete subscriber record
DELETE FROM subscribers 
WHERE user_id = 'c756701f-6c51-4a06-922d-a21e27c49c83';

-- Step 6: Delete user_roles (if exists)
DELETE FROM user_roles 
WHERE user_id = 'c756701f-6c51-4a06-922d-a21e27c49c83';

-- Step 7: Delete domain_invitations
DELETE FROM domain_invitations
WHERE org_id = 'acea40b7-2264-4d0e-8d1f-7d30c6b01e39';

-- Step 8: Delete user record from public.users
DELETE FROM users 
WHERE id = 'c756701f-6c51-4a06-922d-a21e27c49c83';

-- Step 9: Finally, delete the organization
DELETE FROM organizations 
WHERE id = 'acea40b7-2264-4d0e-8d1f-7d30c6b01e39';
