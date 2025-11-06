-- Create trigger function for updating updated_at timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create brands table for multi-brand tracking (Pro tier feature)
CREATE TABLE IF NOT EXISTS public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(org_id, domain)
);

-- Enable RLS
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

-- Org members can view their org's brands
CREATE POLICY "Org members can view brands"
ON public.brands
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
    AND u.org_id = brands.org_id
  )
);

-- Org owners can manage brands (Pro tier only, enforced at application level)
CREATE POLICY "Org owners can manage brands"
ON public.brands
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
    AND u.org_id = brands.org_id
    AND u.role = 'owner'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
    AND u.org_id = brands.org_id
    AND u.role = 'owner'
  )
);

-- Service role can manage brands
CREATE POLICY "Service role can manage brands"
ON public.brands
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Create indexes
CREATE INDEX idx_brands_org_id ON public.brands(org_id);
CREATE INDEX idx_brands_domain ON public.brands(domain);

-- Trigger to update updated_at
CREATE TRIGGER update_brands_updated_at
  BEFORE UPDATE ON public.brands
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Migrate existing organizations to brands table (one-time migration)
INSERT INTO public.brands (org_id, name, domain, is_primary)
SELECT 
  id as org_id,
  name as name,
  domain as domain,
  true as is_primary
FROM public.organizations
WHERE domain IS NOT NULL
ON CONFLICT (org_id, domain) DO NOTHING;