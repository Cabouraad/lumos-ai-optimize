-- Add brand_id to reports tables for brand-specific filtering

-- Add brand_id to weekly_reports table
ALTER TABLE public.weekly_reports 
ADD COLUMN brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE;

-- Add brand_id to reports table
ALTER TABLE public.reports 
ADD COLUMN brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_weekly_reports_brand_id ON public.weekly_reports(brand_id);
CREATE INDEX IF NOT EXISTS idx_reports_brand_id ON public.reports(brand_id);

-- Update unique constraints to include brand_id (optional - allows multiple reports per week per org per brand)
-- Note: Existing constraints remain, but we now support filtering by brand_id