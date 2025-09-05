-- Move user starter@test.app to the existing CarGurus organization
UPDATE users 
SET org_id = '89164395-6e33-4775-be16-c7f484d9f16d'
WHERE email = 'starter@test.app';