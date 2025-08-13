-- Fix the organizations RLS policy bug
DROP POLICY IF EXISTS org_read ON organizations;

CREATE POLICY org_read 
ON organizations 
FOR SELECT 
USING (EXISTS (
  SELECT 1 
  FROM users u 
  WHERE u.id = auth.uid() 
  AND u.org_id = organizations.id
));