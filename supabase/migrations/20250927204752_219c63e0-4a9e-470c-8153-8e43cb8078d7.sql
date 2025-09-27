-- Update the existing user record to ensure correct org_id
UPDATE public.users 
SET org_id = '4d1d9ebb-d13e-4094-99c8-e74fe8526239'::uuid
WHERE email = 'abouraa.chri@gmail.com' OR id = '9f1ce7bc-3e6f-4080-800b-2f402bfd7bf5';