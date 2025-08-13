-- Fix the RLS policy for organizations update
DROP POLICY IF EXISTS "org_update_owner" ON public.organizations;

CREATE POLICY "org_update_owner" 
ON public.organizations 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 
    FROM users u 
    WHERE (u.id = auth.uid()) 
      AND (u.org_id = organizations.id) 
      AND (u.role = 'owner'::text)
  )
);