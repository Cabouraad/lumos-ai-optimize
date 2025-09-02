-- Create domain enforcement policies and functions

-- Function to check if user's organization has verified domain
CREATE OR REPLACE FUNCTION public.user_org_domain_verified()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT o.verified_at IS NOT NULL
     FROM public.organizations o
     JOIN public.users u ON u.org_id = o.id
     WHERE u.id = auth.uid()),
    false
  );
$$;

-- Function to check if email domain matches org domain
CREATE OR REPLACE FUNCTION public.email_matches_org_domain(email_address TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  email_domain TEXT;
  org_domain TEXT;
  user_org_id UUID;
BEGIN
  -- Get current user's org ID
  SELECT u.org_id INTO user_org_id
  FROM public.users u 
  WHERE u.id = auth.uid();
  
  IF user_org_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get org domain
  SELECT o.domain INTO org_domain
  FROM public.organizations o
  WHERE o.id = user_org_id;
  
  IF org_domain IS NULL THEN
    RETURN true; -- No domain restriction if org has no domain
  END IF;
  
  -- Extract domain from email
  email_domain := split_part(email_address, '@', 2);
  
  -- Check if domains match
  RETURN LOWER(email_domain) = LOWER(org_domain);
END;
$$;

-- Enhanced RLS policy for domain-bound resources (example for prompts)
-- This policy allows access when domain verification bypass is enabled OR domain is verified
DROP POLICY IF EXISTS "Domain verification enforcement" ON public.prompts;
CREATE POLICY "Domain-bound resource access" ON public.prompts
FOR ALL 
USING (
  -- Allow if domain verification bypass is enabled
  public.get_feature_flag('domain_verification_bypass') = true
  -- Or if user's org domain is verified
  OR public.user_org_domain_verified() = true
  -- Or if user has access through org membership (existing policy)
  OR EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() 
    AND u.org_id = prompts.org_id
  )
)
WITH CHECK (
  public.get_feature_flag('domain_verification_bypass') = true
  OR public.user_org_domain_verified() = true
  OR EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() 
    AND u.org_id = prompts.org_id
  )
);

-- Enhanced RLS policy for recommendations
DROP POLICY IF EXISTS "Domain verification enforcement" ON public.recommendations;
CREATE POLICY "Domain-bound recommendations access" ON public.recommendations
FOR ALL 
USING (
  public.get_feature_flag('domain_verification_bypass') = true
  OR public.user_org_domain_verified() = true
  OR EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() 
    AND u.org_id = recommendations.org_id
  )
)
WITH CHECK (
  public.get_feature_flag('domain_verification_bypass') = true
  OR public.user_org_domain_verified() = true
  OR EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() 
    AND u.org_id = recommendations.org_id
  )
);

-- Table to track domain-bound invitations
CREATE TABLE IF NOT EXISTS public.domain_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  domain_verified_at_invite TIMESTAMP WITH TIME ZONE, -- Domain verification status when invite was sent
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(org_id, email)
);

-- Enable RLS on domain invitations
ALTER TABLE public.domain_invitations ENABLE ROW LEVEL SECURITY;

-- RLS policy for domain invitations
CREATE POLICY "Org members can manage invitations" ON public.domain_invitations
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() 
    AND u.org_id = domain_invitations.org_id
    AND u.role = 'owner'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() 
    AND u.org_id = domain_invitations.org_id
    AND u.role = 'owner'
  )
);

-- Function to validate domain-bound invitation
CREATE OR REPLACE FUNCTION public.validate_domain_invitation(
  p_org_id UUID,
  p_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_data RECORD;
  email_domain TEXT;
  result JSONB;
BEGIN
  -- Get organization data
  SELECT domain, verified_at INTO org_data
  FROM public.organizations
  WHERE id = p_org_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'Organization not found'
    );
  END IF;
  
  -- Check feature flag bypass
  IF public.get_feature_flag('domain_verification_bypass') = true THEN
    RETURN jsonb_build_object(
      'valid', true,
      'reason', 'Domain verification bypassed'
    );
  END IF;
  
  -- If no domain set, allow any email
  IF org_data.domain IS NULL THEN
    RETURN jsonb_build_object(
      'valid', true,
      'reason', 'No domain restriction'
    );
  END IF;
  
  -- If domain not verified, block invitations
  IF org_data.verified_at IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'Domain must be verified before sending invitations'
    );
  END IF;
  
  -- Extract email domain
  email_domain := split_part(p_email, '@', 2);
  
  -- Check if email domain matches org domain
  IF LOWER(email_domain) = LOWER(org_data.domain) THEN
    RETURN jsonb_build_object(
      'valid', true,
      'reason', 'Email domain matches verified organization domain'
    );
  ELSE
    RETURN jsonb_build_object(
      'valid', false,
      'reason', format('Email domain "%s" does not match organization domain "%s"', 
                      email_domain, org_data.domain)
    );
  END IF;
END;
$$;

-- Add updated_at trigger for domain_invitations
CREATE TRIGGER update_domain_invitations_updated_at
  BEFORE UPDATE ON public.domain_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();