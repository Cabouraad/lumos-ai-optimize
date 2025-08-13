-- Add keyword and context fields to organizations table for better AI prompt suggestions
ALTER TABLE public.organizations 
ADD COLUMN keywords TEXT[] DEFAULT '{}',
ADD COLUMN products_services TEXT,
ADD COLUMN target_audience TEXT,
ADD COLUMN business_description TEXT;

-- Add index for better performance when querying by keywords
CREATE INDEX idx_organizations_keywords ON public.organizations USING GIN(keywords);