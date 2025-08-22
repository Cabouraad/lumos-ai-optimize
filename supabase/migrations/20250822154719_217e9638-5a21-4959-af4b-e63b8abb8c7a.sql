-- Address Security Definer View issue by examining remaining SECURITY DEFINER functions
-- The linter may be flagging certain SECURITY DEFINER functions that act like views

-- First, let's fix any functions that might be incorrectly set to SECURITY DEFINER
-- Fix update trigger functions to use SECURITY INVOKER where possible
CREATE OR REPLACE FUNCTION public.update_subscribers_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER  -- Changed from SECURITY DEFINER
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

-- However, some trigger functions MUST remain SECURITY DEFINER to work properly
-- Let's be more selective and only keep SECURITY DEFINER for functions that truly need it

-- Remove SECURITY DEFINER from functions that don't strictly need elevated privileges
-- keeping only those that perform critical system operations

-- Note: The linter might be detecting that some functions act as "views" 
-- because they return table data with elevated privileges
-- This has been addressed by converting data-access functions to SECURITY INVOKER earlier