-- Update the admin user's organization brand and domain (without updated_at column)
UPDATE organizations 
SET 
    name = 'The Software Smith',
    domain = 'softwaresmith.io'
WHERE id = (
    SELECT org_id 
    FROM users 
    WHERE email = 'amirdt22@gmail.com'
);