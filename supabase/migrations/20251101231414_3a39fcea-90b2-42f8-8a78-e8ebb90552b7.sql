-- Add feature flag column to organizations table
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS enable_ca_scoring boolean DEFAULT false;

COMMENT ON COLUMN public.organizations.enable_ca_scoring IS 'Feature flag to enable Citation Authority scoring for this org';

-- Create admin function to toggle CA for specific orgs
CREATE OR REPLACE FUNCTION public.admin_toggle_ca_scoring(p_org_id uuid, p_enable boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.organizations
  SET enable_ca_scoring = p_enable
  WHERE id = p_org_id;
  
  RAISE NOTICE 'CA scoring % for org %', CASE WHEN p_enable THEN 'enabled' ELSE 'disabled' END, p_org_id;
END;
$$;

COMMENT ON FUNCTION public.admin_toggle_ca_scoring IS 'Admin function to enable/disable Citation Authority scoring for specific organizations';