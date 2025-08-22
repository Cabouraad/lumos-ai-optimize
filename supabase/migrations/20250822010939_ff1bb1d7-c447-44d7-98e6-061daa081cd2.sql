-- Update the admin user's organization brand and domain
UPDATE organizations 
SET 
    name = 'The Software Smith',
    domain = 'softwaresmith.io',
    updated_at = now()
WHERE id = (
    SELECT org_id 
    FROM users 
    WHERE email = 'amirdt22@gmail.com'
);