-- Fix Authentication System: Clean up duplicate user accounts and add constraints

-- Step 1: Identify and remove older duplicate user accounts, keeping the most recent ones
-- We'll keep the most recent account for each email address

-- For abouraa.chri@gmail.com: Keep the newer account (9f1ce7bc-3e6f-4080-800b-2f402bfd7bf5)
-- For chris@pitstopgas.net: Keep the newer account (19605d8f-4b45-45e2-9e0b-ed514c0f1f92)

-- Delete the older duplicate accounts
DELETE FROM users 
WHERE id IN (
  '40bbcbae-65cf-43f1-8182-ff06e0b625e1',  -- older abouraa.chri@gmail.com
  '4fde35a5-2eed-4c10-815b-900a248af7bf'   -- older chris@pitstopgas.net
);

-- Step 2: Add unique constraint on email to prevent future duplicates
ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);

-- Step 3: Create a trigger to prevent duplicate email creation in the future
CREATE OR REPLACE FUNCTION prevent_duplicate_emails()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if email already exists (case-insensitive)
  IF EXISTS (
    SELECT 1 FROM users 
    WHERE LOWER(email) = LOWER(NEW.email) 
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION 'Email address already exists: %', NEW.email;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for insert and update
CREATE TRIGGER prevent_duplicate_emails_trigger
  BEFORE INSERT OR UPDATE OF email ON users
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_emails();

-- Step 4: Add function to get consistent user data
CREATE OR REPLACE FUNCTION get_user_auth_data(user_email text)
RETURNS TABLE(
  user_id uuid,
  org_id uuid,
  role text,
  org_name text,
  keywords text[]
) 
LANGUAGE sql 
SECURITY DEFINER 
SET search_path TO 'public'
AS $$
  SELECT 
    u.id as user_id,
    u.org_id,
    u.role,
    o.name as org_name,
    o.keywords
  FROM users u
  JOIN organizations o ON o.id = u.org_id
  WHERE LOWER(u.email) = LOWER(user_email)
  LIMIT 1;
$$;