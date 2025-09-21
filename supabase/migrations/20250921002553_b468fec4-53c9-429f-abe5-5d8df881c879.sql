-- Fix Authentication System: Clean up ALL duplicate user accounts properly

-- Step 1: Create a temporary table to identify which users to keep (most recent for each email)
CREATE TEMP TABLE users_to_keep AS
WITH ranked_users AS (
  SELECT 
    id,
    email,
    org_id,
    role,
    created_at,
    ROW_NUMBER() OVER (PARTITION BY LOWER(email) ORDER BY created_at DESC) as rn
  FROM users
  WHERE email IN ('abouraa.chri@gmail.com', 'chris@pitstopgas.net')
)
SELECT id, email, org_id, role, created_at
FROM ranked_users 
WHERE rn = 1;

-- Step 2: Show what we're keeping
SELECT 'KEEPING THESE USERS:' as action, email, id, org_id, created_at FROM users_to_keep;

-- Step 3: Delete all duplicate users except the ones we want to keep
DELETE FROM users 
WHERE email IN ('abouraa.chri@gmail.com', 'chris@pitstopgas.net')
  AND id NOT IN (SELECT id FROM users_to_keep);

-- Step 4: Verify clean state
SELECT 'REMAINING USERS:' as action, email, id, org_id, created_at 
FROM users 
WHERE email IN ('abouraa.chri@gmail.com', 'chris@pitstopgas.net')
ORDER BY email;

-- Step 5: Now add the unique constraint
ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);