-- FIX CRITICAL SECURITY VULNERABILITY: Remove anonymous access to user_subscription_safe view
-- Current issue: The view grants SELECT to 'anon' role, allowing unauthenticated users to access subscription data

-- Revoke dangerous anonymous access to subscription data
REVOKE SELECT ON public.user_subscription_safe FROM anon;

-- Verify the view respects RLS by checking current grants
SELECT 
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.role_table_grants 
WHERE table_name = 'user_subscription_safe' 
  AND table_schema = 'public'
ORDER BY grantee, privilege_type;

-- Confirm the view definition is secure
SELECT definition 
FROM pg_views 
WHERE viewname = 'user_subscription_safe' 
  AND schemaname = 'public';