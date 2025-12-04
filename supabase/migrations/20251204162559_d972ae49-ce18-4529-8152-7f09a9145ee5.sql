-- Add brand_id column to brand_catalog for brand-level competitor isolation
ALTER TABLE public.brand_catalog 
ADD COLUMN brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE;

-- Create index for efficient brand-level queries
CREATE INDEX idx_brand_catalog_brand_id ON public.brand_catalog(brand_id);

-- Drop the existing unique constraint if it exists
ALTER TABLE public.brand_catalog DROP CONSTRAINT IF EXISTS brand_catalog_org_id_name_key;

-- Create unique index including brand_id (using expression for case-insensitive matching)
CREATE UNIQUE INDEX brand_catalog_org_brand_name_unique_idx 
ON public.brand_catalog(org_id, brand_id, LOWER(TRIM(name)));

-- Comment explaining the change
COMMENT ON COLUMN public.brand_catalog.brand_id IS 'Brand this competitor was detected for. NULL means org-level (legacy data or org brands).';