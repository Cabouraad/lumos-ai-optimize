-- Create table for new visibility optimizations system
CREATE TABLE IF NOT EXISTS public.visibility_optimizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt_id UUID NOT NULL REFERENCES public.prompts(id) ON DELETE CASCADE,
  optimization_type TEXT NOT NULL CHECK (optimization_type IN ('blog_post', 'social_post', 'video_content', 'press_release', 'case_study', 'whitepaper', 'podcast_appearance', 'community_answer')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  content_specifications JSONB NOT NULL DEFAULT '{}',
  distribution_strategy JSONB NOT NULL DEFAULT '{}',
  implementation_plan JSONB NOT NULL DEFAULT '{}',
  impact_assessment JSONB NOT NULL DEFAULT '{}',
  content_strategy JSONB NOT NULL DEFAULT '{}',
  priority_score INTEGER NOT NULL DEFAULT 50 CHECK (priority_score >= 1 AND priority_score <= 100),
  difficulty_level TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty_level IN ('easy', 'medium', 'hard')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.visibility_optimizations ENABLE ROW LEVEL SECURITY;

-- Create policies for visibility optimizations
CREATE POLICY "Users can view their org's visibility optimizations" 
ON public.visibility_optimizations 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.prompts p
  JOIN public.users u ON u.org_id = p.org_id
  WHERE p.id = visibility_optimizations.prompt_id
  AND u.id = auth.uid()
));

CREATE POLICY "Users can create visibility optimizations for their org's prompts" 
ON public.visibility_optimizations 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.prompts p
  JOIN public.users u ON u.org_id = p.org_id
  WHERE p.id = visibility_optimizations.prompt_id
  AND u.id = auth.uid()
));

CREATE POLICY "Users can update their org's visibility optimizations" 
ON public.visibility_optimizations 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.prompts p
  JOIN public.users u ON u.org_id = p.org_id
  WHERE p.id = visibility_optimizations.prompt_id
  AND u.id = auth.uid()
));

-- Create index for better performance
CREATE INDEX idx_visibility_optimizations_prompt_id ON public.visibility_optimizations(prompt_id);
CREATE INDEX idx_visibility_optimizations_priority ON public.visibility_optimizations(priority_score DESC);
CREATE INDEX idx_visibility_optimizations_status ON public.visibility_optimizations(status);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_visibility_optimizations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_visibility_optimizations_updated_at
  BEFORE UPDATE ON public.visibility_optimizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_visibility_optimizations_updated_at();