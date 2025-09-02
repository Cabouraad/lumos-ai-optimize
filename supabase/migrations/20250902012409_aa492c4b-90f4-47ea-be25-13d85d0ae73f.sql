-- Add domain verification fields to organizations table
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS verification_token TEXT,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;

-- Create domain verification tokens for existing organizations
UPDATE public.organizations 
SET verification_token = encode(gen_random_bytes(32), 'hex')
WHERE verification_token IS NULL;

-- Add feature flags table for domain verification bypass
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_name TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on feature flags
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage feature flags
CREATE POLICY "Service role can manage feature flags" ON public.feature_flags
FOR ALL USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Allow authenticated users to read feature flags
CREATE POLICY "Users can read feature flags" ON public.feature_flags
FOR SELECT USING (auth.uid() IS NOT NULL);

-- Insert domain verification bypass flag (default ON)
INSERT INTO public.feature_flags (flag_name, enabled, description)
VALUES ('domain_verification_bypass', true, 'Bypass domain verification requirements for development')
ON CONFLICT (flag_name) DO NOTHING;

-- Function to get feature flag value
CREATE OR REPLACE FUNCTION public.get_feature_flag(flag_name TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT enabled FROM public.feature_flags WHERE feature_flags.flag_name = $1),
    false
  );
$$;

-- Function to generate new verification token
CREATE OR REPLACE FUNCTION public.generate_verification_token(org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_token TEXT;
BEGIN
  -- Generate new token
  new_token := encode(gen_random_bytes(32), 'hex');
  
  -- Update organization
  UPDATE public.organizations 
  SET 
    verification_token = new_token,
    verified_at = NULL,
    updated_at = now()
  WHERE id = org_id;
  
  RETURN new_token;
END;
$$;

-- Function to mark domain as verified
CREATE OR REPLACE FUNCTION public.mark_domain_verified(org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.organizations 
  SET 
    verified_at = now(),
    updated_at = now()
  WHERE id = org_id;
  
  RETURN FOUND;
END;
$$;

-- Update organizations table RLS for domain verification
CREATE POLICY "Domain verification enforcement" ON public.organizations
FOR INSERT 
WITH CHECK (
  -- Allow if domain verification bypass is enabled
  public.get_feature_flag('domain_verification_bypass') = true
  -- Or if domain is verified (for updates)
  OR verified_at IS NOT NULL
);

-- Add trigger for updated_at
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();