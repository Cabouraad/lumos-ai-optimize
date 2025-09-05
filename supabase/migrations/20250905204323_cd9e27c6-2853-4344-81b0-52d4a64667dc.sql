-- Add the missing updated_at column first
ALTER TABLE organizations ADD COLUMN updated_at timestamp with time zone DEFAULT now();

-- Move user starter@test.app to the existing CarGurus organization
-- instead of trying to create a duplicate domain
UPDATE users 
SET org_id = '89164395-6e33-4775-be16-c7f484d9f16d'
WHERE email = 'starter@test.app';