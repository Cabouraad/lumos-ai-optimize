-- Add brand-level business context columns to brands table
ALTER TABLE public.brands
ADD COLUMN IF NOT EXISTS business_description text,
ADD COLUMN IF NOT EXISTS products_services text,
ADD COLUMN IF NOT EXISTS keywords text[],
ADD COLUMN IF NOT EXISTS target_audience text;

-- Add comment explaining the fields
COMMENT ON COLUMN public.brands.business_description IS 'Brand-specific business description for AI prompt generation';
COMMENT ON COLUMN public.brands.products_services IS 'Brand-specific products and services';
COMMENT ON COLUMN public.brands.keywords IS 'Brand-specific keywords for prompt generation';
COMMENT ON COLUMN public.brands.target_audience IS 'Brand-specific target audience';