-- Force Row Level Security on prompt_visibility_14d to ensure security is always applied
ALTER TABLE public.prompt_visibility_14d FORCE ROW LEVEL SECURITY;

-- Also check and fix any potential issues with the existing policy
-- The current policy should work, but let's make it more explicit
DROP POLICY IF EXISTS "prompt_visibility_14d_select" ON public.prompt_visibility_14d;

CREATE POLICY "prompt_visibility_14d_org_access" 
ON public.prompt_visibility_14d
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() 
    AND u.org_id = prompt_visibility_14d.org_id
    AND u.org_id IS NOT NULL
  )
);