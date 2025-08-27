-- Add security_barrier to the latest_prompt_provider_responses view to resolve security warnings
-- This ensures the view's WHERE clause is always applied first, preventing data leakage

ALTER VIEW public.latest_prompt_provider_responses SET (security_barrier = true);

-- Ensure the view maintains its security_invoker property
ALTER VIEW public.latest_prompt_provider_responses SET (security_invoker = true);

-- Add a comment to document the security configuration
COMMENT ON VIEW public.latest_prompt_provider_responses IS 'Secure view with security_barrier and security_invoker enabled to prevent unauthorized access to organization data';