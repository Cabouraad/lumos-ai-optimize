-- Phase 1: Create Secure Role Infrastructure (Fixed)
-- This migration creates a proper role management system that prevents privilege escalation

-- 1. Create enum type for roles
CREATE TYPE public.app_role AS ENUM ('owner', 'member', 'admin');

-- 2. Create user_roles table with proper constraints
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    granted_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, role, org_id)
);

-- Create indexes for performance
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_org_id ON public.user_roles(org_id);
CREATE INDEX idx_user_roles_lookup ON public.user_roles(user_id, role);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- RLS Policy: Service role has full access
CREATE POLICY "Service role full access to user_roles"
ON public.user_roles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 3. Create security definer function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.has_role(UUID, app_role) TO authenticated;

-- 4. Create security definer function to get user's primary role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role::text
      WHEN 'owner' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'member' THEN 3
    END
  LIMIT 1
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_user_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(UUID) TO service_role;

-- 5. Create security definer function to get user's org_id and role
CREATE OR REPLACE FUNCTION public.get_user_org_and_role(_user_id UUID)
RETURNS TABLE(org_id UUID, role TEXT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.org_id, ur.role::text
  FROM public.user_roles ur
  WHERE ur.user_id = _user_id
  ORDER BY 
    CASE ur.role::text
      WHEN 'owner' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'member' THEN 3
    END
  LIMIT 1
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_user_org_and_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_org_and_role(UUID) TO service_role;

-- 6. Migrate existing role data from users table to user_roles table
-- FIXED: Only migrate users that exist in auth.users to avoid foreign key violations
INSERT INTO public.user_roles (user_id, role, org_id, granted_at, granted_by)
SELECT 
  u.id,
  u.role::app_role,
  u.org_id,
  u.created_at,
  NULL -- No granted_by info for existing records
FROM public.users u
WHERE u.org_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM auth.users au WHERE au.id = u.id) -- Only users that exist in auth.users
ON CONFLICT (user_id, role, org_id) DO NOTHING;

-- 7. Create trigger to keep users.role in sync with user_roles (for backward compatibility during transition)
CREATE OR REPLACE FUNCTION public.sync_user_role_to_users()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When a role is inserted/updated in user_roles, update users.role
  -- This maintains backward compatibility during the transition period
  UPDATE public.users
  SET role = NEW.role::text
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_user_role_after_insert_update
AFTER INSERT OR UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_role_to_users();

-- 8. Add validation to ensure role consistency
CREATE OR REPLACE FUNCTION public.validate_role_consistency()
RETURNS TABLE(user_id UUID, users_role TEXT, user_roles_role TEXT, status TEXT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    u.id as user_id,
    u.role as users_role,
    ur.role::text as user_roles_role,
    CASE 
      WHEN u.role = ur.role::text THEN 'OK'
      WHEN ur.role IS NULL THEN 'MISSING_IN_USER_ROLES'
      ELSE 'MISMATCH'
    END as status
  FROM public.users u
  LEFT JOIN public.user_roles ur ON ur.user_id = u.id
  WHERE u.org_id IS NOT NULL;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.validate_role_consistency() TO authenticated;

-- 9. Clean up orphaned users (users in public.users but not in auth.users)
-- Log them first for audit purposes
DO $$
DECLARE
  orphaned_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphaned_count
  FROM public.users u
  WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = u.id);
  
  IF orphaned_count > 0 THEN
    RAISE NOTICE 'Found % orphaned user records (users in public.users but not in auth.users)', orphaned_count;
  END IF;
END $$;

COMMENT ON TABLE public.user_roles IS 'Stores user roles separately from user identity for security. Prevents privilege escalation attacks by using security definer functions.';
COMMENT ON FUNCTION public.has_role(UUID, app_role) IS 'Security definer function to check if a user has a specific role. Bypasses RLS safely.';
COMMENT ON FUNCTION public.get_user_role(UUID) IS 'Security definer function to get user primary role. Returns highest priority role (owner > admin > member).';
COMMENT ON FUNCTION public.get_user_org_and_role(UUID) IS 'Security definer function to get user org_id and role. Used by edge functions for authorization.';