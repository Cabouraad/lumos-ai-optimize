-- Add location fields to organizations table
ALTER TABLE public.organizations 
ADD COLUMN business_city text,
ADD COLUMN business_state text,
ADD COLUMN business_country text DEFAULT 'United States',
ADD COLUMN enable_localized_prompts boolean DEFAULT false;