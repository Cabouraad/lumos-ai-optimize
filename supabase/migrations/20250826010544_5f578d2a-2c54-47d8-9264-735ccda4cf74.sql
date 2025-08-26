-- Update the recommendations type constraint to match the application expectations
ALTER TABLE public.recommendations DROP CONSTRAINT recommendations_type_check;

-- Add the new constraint with the expected content types
ALTER TABLE public.recommendations ADD CONSTRAINT recommendations_type_check 
CHECK (type = ANY (ARRAY[
  'blog_post'::text, 
  'case_study'::text, 
  'comparison'::text, 
  'tutorial'::text, 
  'social_post'::text, 
  'landing_page'::text,
  'content'::text,
  'social'::text,
  'site'::text,
  'knowledge'::text
]));