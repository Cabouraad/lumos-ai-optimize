-- Allow users to exist without an organization during onboarding
-- This fixes the sign-up issue where new users cannot be created because org_id is required
ALTER TABLE public.users 
ALTER COLUMN org_id DROP NOT NULL;

-- Add a helpful comment
COMMENT ON COLUMN public.users.org_id IS 'Organization ID - null during onboarding, set after organization creation';