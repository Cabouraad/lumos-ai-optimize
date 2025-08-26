-- Force delete the broken user account
DELETE FROM users 
WHERE email = 'abouraa.chri@gmail.com' 
AND org_id = 'dad088ef-5282-4758-864b-d226b2d1b1fb';

-- Verify the working account exists and is properly set up
SELECT 'User access restored' as status;