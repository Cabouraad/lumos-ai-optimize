-- Fix the function search path security warning
-- Update the get_current_user_org_id function to have an immutable search path

CREATE OR REPLACE FUNCTION public.get_current_user_org_id()
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER  -- Uses caller's permissions, not function owner's
STABLE
SET search_path = public  -- Fix: Set immutable search path for security
AS $$
  -- This function will respect RLS policies
  SELECT org_id 
  FROM public.users 
  WHERE id = auth.uid()
  LIMIT 1;
$$;