-- Fix the RLS policy bug for optimizations table
-- The current policy has a logic error: u.org_id = u.org_id (always true)
-- Should be optimizations.org_id = u.org_id for proper org isolation

DROP POLICY IF EXISTS optimizations_insert ON public.optimizations;

CREATE POLICY "optimizations_insert" ON public.optimizations 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() 
    AND u.org_id = optimizations.org_id
  )
);

-- Also fix the select policy to ensure proper org isolation
DROP POLICY IF EXISTS optimizations_select ON public.optimizations;

CREATE POLICY "optimizations_select" ON public.optimizations 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() 
    AND u.org_id = optimizations.org_id
  )
);