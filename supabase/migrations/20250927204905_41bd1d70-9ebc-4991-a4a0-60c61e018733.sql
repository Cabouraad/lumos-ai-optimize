-- Remove the duplicate user record that has a different org_id
-- Keep the one with the correct org_id (4d1d9ebb-d13e-4094-99c8-e74fe8526239)
DELETE FROM public.users 
WHERE email = 'abouraa.chri@gmail.com' 
  AND id = '40bbcbae-65cf-43f1-8182-ff06e0b625e1'
  AND org_id = 'dad088ef-5282-4758-864b-d226b2d1b1fb';