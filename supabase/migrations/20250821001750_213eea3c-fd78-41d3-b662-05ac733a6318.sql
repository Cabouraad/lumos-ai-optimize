-- Add llms.txt generation columns to organizations
ALTER TABLE organizations 
ADD COLUMN llms_txt text,
ADD COLUMN llms_last_generated_at timestamp with time zone,
ADD COLUMN llms_pages jsonb DEFAULT '[]'::jsonb,
ADD COLUMN llms_generation_source text;

-- Create llms_generations table for tracking generation history
CREATE TABLE public.llms_generations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL,
  generated_at timestamp with time zone NOT NULL DEFAULT now(),
  source text NOT NULL,
  pages_found integer DEFAULT 0,
  content_extracted boolean DEFAULT false,
  llms_txt_content text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on llms_generations
ALTER TABLE public.llms_generations ENABLE ROW LEVEL SECURITY;

-- Create policies for llms_generations
CREATE POLICY "Users can view their org's generations" 
ON public.llms_generations 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM users u 
  WHERE u.id = auth.uid() AND u.org_id = llms_generations.org_id
));

-- Allow service role to insert
CREATE POLICY "Service can insert generations"
ON public.llms_generations
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- Create index for better performance
CREATE INDEX idx_llms_generations_org_id ON public.llms_generations(org_id);
CREATE INDEX idx_llms_generations_generated_at ON public.llms_generations(generated_at DESC);