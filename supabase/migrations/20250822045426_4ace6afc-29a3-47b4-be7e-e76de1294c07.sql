-- =====================================
-- COMPREHENSIVE SECURITY FIX FOR SUBSCRIBERS TABLE
-- =====================================

-- 1. Add strict RLS policies for all operations on subscribers table
-- These policies ensure complete data isolation and prevent unauthorized access

-- INSERT Policy: Only service role can insert subscription data
-- This prevents users from creating fake subscriptions
CREATE POLICY "subscribers_insert_service_only"
ON public.subscribers
FOR INSERT
TO service_role
WITH CHECK (true);

-- UPDATE Policy: Only service role can update subscription data  
-- This prevents users from modifying their subscription status
CREATE POLICY "subscribers_update_service_only"
ON public.subscribers
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- DELETE Policy: Only service role can delete subscription data
-- This prevents users from deleting subscription records
CREATE POLICY "subscribers_delete_service_only"
ON public.subscribers
FOR DELETE
TO service_role
USING (true);

-- =====================================
-- 2. CREATE SECURE VIEW FOR SAFE USER ACCESS
-- =====================================

-- Create a view that exposes only safe, non-sensitive subscription data
-- This masks sensitive payment information from regular users
CREATE OR REPLACE VIEW public.user_subscription_safe AS
SELECT 
  user_id,
  email,
  subscription_tier,
  subscribed,
  trial_started_at,
  trial_expires_at,
  subscription_end,
  -- Mask sensitive payment data
  CASE 
    WHEN stripe_customer_id IS NOT NULL THEN 'has_payment_method'
    ELSE NULL
  END as payment_status,
  created_at,
  updated_at
FROM public.subscribers
WHERE user_id = auth.uid();

-- Grant access to the safe view
GRANT SELECT ON public.user_subscription_safe TO authenticated;

-- =====================================
-- 3. CREATE SECURE FUNCTIONS FOR USER OPERATIONS
-- =====================================

-- Function to safely check user subscription status
-- This replaces direct table access for applications
CREATE OR REPLACE FUNCTION public.get_user_subscription_status()
RETURNS TABLE (
  subscription_tier text,
  subscribed boolean,
  trial_expires_at timestamptz,
  subscription_end timestamptz,
  payment_collected boolean
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.subscription_tier,
    s.subscribed,
    s.trial_expires_at,
    s.subscription_end,
    COALESCE(s.payment_collected, false) as payment_collected
  FROM public.subscribers s
  WHERE s.user_id = auth.uid();
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_subscription_status() TO authenticated;

-- =====================================
-- 4. ADD SECURITY COMMENTS AND DOCUMENTATION
-- =====================================

COMMENT ON POLICY "subscribers_insert_service_only" ON public.subscribers IS
'SECURITY: Only service role can insert subscription data to prevent fraud and unauthorized subscription creation.';

COMMENT ON POLICY "subscribers_update_service_only" ON public.subscribers IS  
'SECURITY: Only service role can update subscription data to prevent users from modifying their own subscription status or payment information.';

COMMENT ON POLICY "subscribers_delete_service_only" ON public.subscribers IS
'SECURITY: Only service role can delete subscription data to maintain audit trail and prevent data loss.';

COMMENT ON VIEW public.user_subscription_safe IS
'SECURITY: Safe view for user subscription data that masks sensitive payment information like Stripe customer IDs.';

COMMENT ON FUNCTION public.get_user_subscription_status() IS
'SECURITY: Secure function to retrieve user subscription status without exposing sensitive payment data.';

-- =====================================
-- 5. ADD AUDIT LOGGING (OPTIONAL ENHANCEMENT)
-- =====================================

-- Create audit log table for subscription changes
CREATE TABLE IF NOT EXISTS public.subscribers_audit (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  subscriber_user_id uuid NOT NULL,
  action text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  changed_by uuid,
  changed_at timestamptz DEFAULT now(),
  ip_address inet,
  user_agent text
);

-- Enable RLS on audit table
ALTER TABLE public.subscribers_audit ENABLE ROW LEVEL SECURITY;

-- Only service role can access audit logs
CREATE POLICY "audit_service_only"
ON public.subscribers_audit
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create audit trigger function
CREATE OR REPLACE FUNCTION public.subscribers_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.subscribers_audit (
    subscriber_user_id,
    action,
    old_values,
    new_values,
    changed_by
  ) VALUES (
    COALESCE(NEW.user_id, OLD.user_id),
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    auth.uid()
  );
  
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- Create audit trigger
DROP TRIGGER IF EXISTS subscribers_audit_trigger ON public.subscribers;
CREATE TRIGGER subscribers_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.subscribers
  FOR EACH ROW EXECUTE FUNCTION public.subscribers_audit_trigger();

COMMENT ON TABLE public.subscribers_audit IS
'SECURITY: Audit log for all changes to subscription data for security monitoring and compliance.';