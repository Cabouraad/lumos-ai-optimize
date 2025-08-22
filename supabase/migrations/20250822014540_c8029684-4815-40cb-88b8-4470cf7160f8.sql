-- Drop the existing overly permissive RLS policy
DROP POLICY IF EXISTS "select_own_subscription" ON public.subscribers;

-- Create a more secure RLS policy that prioritizes user_id over email
-- This follows the principle of least privilege and reduces attack surface
CREATE POLICY "secure_subscription_access" 
ON public.subscribers 
FOR SELECT 
TO authenticated
USING (
  -- Primary check: if user_id exists, only allow access to own record
  (user_id IS NOT NULL AND user_id = auth.uid()) 
  OR 
  -- Fallback: only for records without user_id, allow email-based access
  -- This should be temporary for legacy records or during user onboarding
  (user_id IS NULL AND email = auth.email())
);

-- Add a comment explaining the security consideration
COMMENT ON POLICY "secure_subscription_access" ON public.subscribers IS 
'Secure access to subscription records: prioritizes user_id matching over email matching to prevent unauthorized access to customer data';