-- Create content_studio_items table for Content Studio feature
CREATE TABLE public.content_studio_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL,
  created_by uuid NOT NULL,
  recommendation_id uuid REFERENCES public.recommendations(id) ON DELETE SET NULL,
  prompt_id uuid REFERENCES public.prompts(id) ON DELETE SET NULL,
  topic_key text NOT NULL,
  llm_targets jsonb NOT NULL DEFAULT '[]'::jsonb,
  content_type text NOT NULL,
  outline jsonb NOT NULL DEFAULT '{}'::jsonb,
  faqs jsonb NOT NULL DEFAULT '[]'::jsonb,
  key_entities jsonb NOT NULL DEFAULT '[]'::jsonb,
  schema_suggestions jsonb NOT NULL DEFAULT '[]'::jsonb,
  tone_guidelines jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add foreign key to organizations
ALTER TABLE public.content_studio_items
ADD CONSTRAINT content_studio_items_org_id_fkey 
FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Create index for org_id lookups
CREATE INDEX idx_content_studio_items_org_id ON public.content_studio_items(org_id);
CREATE INDEX idx_content_studio_items_created_at ON public.content_studio_items(created_at DESC);

-- Enable RLS
ALTER TABLE public.content_studio_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies (following existing org-scoped patterns)
CREATE POLICY "content_studio_items_select_own_org" 
ON public.content_studio_items 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM users u 
  WHERE u.id = auth.uid() AND u.org_id = content_studio_items.org_id
));

CREATE POLICY "content_studio_items_insert_own_org" 
ON public.content_studio_items 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM users u 
  WHERE u.id = auth.uid() AND u.org_id = content_studio_items.org_id
));

CREATE POLICY "content_studio_items_update_own_org" 
ON public.content_studio_items 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM users u 
  WHERE u.id = auth.uid() AND u.org_id = content_studio_items.org_id
));

CREATE POLICY "content_studio_items_service_role" 
ON public.content_studio_items 
FOR ALL 
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_content_studio_items_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER update_content_studio_items_updated_at
BEFORE UPDATE ON public.content_studio_items
FOR EACH ROW
EXECUTE FUNCTION public.update_content_studio_items_updated_at();