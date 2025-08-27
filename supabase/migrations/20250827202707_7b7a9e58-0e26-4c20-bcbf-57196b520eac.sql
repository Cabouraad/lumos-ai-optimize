-- Fix conflicting RLS policies on users table
-- Remove the overly restrictive blocking policy that prevents legitimate user access

-- Drop the conflicting blocking policy
DROP POLICY IF EXISTS "users_block_all_other_access" ON public.users;

-- The remaining policies are now:
-- 1. "users_select_own_data_only" - allows users to SELECT their own data only
-- 2. "users_service_role_only_mutations" - allows service role to perform all operations

-- Add additional comment for clarity
COMMENT ON POLICY "users_select_own_data_only" ON public.users IS 'Allows authenticated users to view only their own user record. Prevents access to other users email addresses and data.';