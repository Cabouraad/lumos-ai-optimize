-- Create report templates table for customizing report content
CREATE TABLE IF NOT EXISTS public.report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  
  -- Section toggles
  include_executive_summary BOOLEAN NOT NULL DEFAULT true,
  include_visibility_overview BOOLEAN NOT NULL DEFAULT true,
  include_brand_presence BOOLEAN NOT NULL DEFAULT true,
  include_competitor_analysis BOOLEAN NOT NULL DEFAULT true,
  include_provider_performance BOOLEAN NOT NULL DEFAULT true,
  include_prompt_performance BOOLEAN NOT NULL DEFAULT true,
  include_citations_sources BOOLEAN NOT NULL DEFAULT true,
  include_historical_trends BOOLEAN NOT NULL DEFAULT true,
  include_recommendations BOOLEAN NOT NULL DEFAULT true,
  
  -- Metric selections
  metrics JSONB NOT NULL DEFAULT '{
    "visibility_score": true,
    "brand_mentions": true,
    "competitor_count": true,
    "avg_prominence": true,
    "citation_count": true,
    "top_prompts": true,
    "low_visibility_prompts": true
  }'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_report_templates_org_id ON public.report_templates(org_id);
CREATE INDEX IF NOT EXISTS idx_report_templates_default ON public.report_templates(org_id, is_default) WHERE is_default = true;

-- RLS Policies
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org's templates"
  ON public.report_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.org_id = report_templates.org_id
    )
  );

CREATE POLICY "Users can create templates for their org"
  ON public.report_templates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.org_id = report_templates.org_id
    )
  );

CREATE POLICY "Users can update their org's templates"
  ON public.report_templates FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.org_id = report_templates.org_id
    )
  );

CREATE POLICY "Users can delete their org's templates"
  ON public.report_templates FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.org_id = report_templates.org_id
    )
  );

CREATE POLICY "Service role can manage all templates"
  ON public.report_templates FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Add template_id to reports tables for tracking which template was used
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.report_templates(id) ON DELETE SET NULL;
ALTER TABLE public.weekly_reports ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.report_templates(id) ON DELETE SET NULL;

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_report_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER report_templates_updated_at
  BEFORE UPDATE ON public.report_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_report_templates_updated_at();