-- Enable RLS on user_subscription_safe table
ALTER TABLE public.user_subscription_safe ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own subscription data
CREATE POLICY "user_subscription_safe_select_own" 
ON public.user_subscription_safe 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND user_id IS NOT NULL 
  AND user_id = auth.uid()
);

-- Policy: Service role has full access for system operations
CREATE POLICY "user_subscription_safe_service_role_all" 
ON public.user_subscription_safe 
FOR ALL 
USING (auth.role() = 'service_role');

-- Policy: Only service role can insert subscription data
CREATE POLICY "user_subscription_safe_insert_service_only" 
ON public.user_subscription_safe 
FOR INSERT 
WITH CHECK (auth.role() = 'service_role');

-- Policy: Only service role can update subscription data
CREATE POLICY "user_subscription_safe_update_service_only" 
ON public.user_subscription_safe 
FOR UPDATE 
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Policy: Only service role can delete subscription data
CREATE POLICY "user_subscription_safe_delete_service_only" 
ON public.user_subscription_safe 
FOR DELETE 
USING (auth.role() = 'service_role');