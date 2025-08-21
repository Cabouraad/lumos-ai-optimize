-- Fix SECURITY DEFINER functions to use explicit search_path for security
-- This prevents search_path manipulation attacks

ALTER FUNCTION public.assert_service_for_user_mutations() 
SET search_path = 'public';

ALTER FUNCTION public.normalize_domain() 
SET search_path = 'public';

ALTER FUNCTION public.assert_service_for_org_insert() 
SET search_path = 'public';

ALTER FUNCTION public.prevent_domain_change() 
SET search_path = 'public';

ALTER FUNCTION public.assert_service_for_llm_provider_mutations() 
SET search_path = 'public';