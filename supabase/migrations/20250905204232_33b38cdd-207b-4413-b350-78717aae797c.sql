-- Update the organization for user starter@test.app
-- Change domain to cargurus.com and name to CarGurus
UPDATE organizations 
SET 
  domain = 'cargurus.com',
  name = 'CarGurus'
WHERE id = '6fc25120-6d41-45c3-8988-13d2a79f6f13';