-- Reports catalog table for structured report management
-- This complements the existing weekly_reports table with a more formal catalog structure

CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  week_key TEXT NOT NULL,                   -- e.g. "2025-W33" (ISO week)
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  storage_path TEXT NOT NULL,               -- e.g. reports/<org>/<week_key>.pdf
  byte_size INTEGER,
  sha256 TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, week_key)
);

-- Create index for performance
CREATE INDEX idx_reports_org_id_week_key ON public.reports(org_id, week_key);
CREATE INDEX idx_reports_period ON public.reports(period_start, period_end);

-- Enable RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Create security definer function to avoid infinite recursion in RLS
CREATE OR REPLACE FUNCTION public.user_can_access_org(target_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.org_id = target_org_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- RLS policies using security definer function
CREATE POLICY "org_members_can_read_reports" ON public.reports
FOR SELECT USING (public.user_can_access_org(org_id));

-- Service role can manage all reports
CREATE POLICY "service_role_can_manage_reports" ON public.reports
FOR ALL USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- Create storage bucket for reports (if not exists)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('reports', 'reports', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for reports bucket
CREATE POLICY "org_members_can_view_reports" ON storage.objects
FOR SELECT USING (
  bucket_id = 'reports' AND
  public.user_can_access_org((storage.foldername(name))[1]::uuid)
);

CREATE POLICY "service_role_can_manage_report_files" ON storage.objects
FOR ALL USING (bucket_id = 'reports' AND auth.role() = 'service_role'::text)
WITH CHECK (bucket_id = 'reports' AND auth.role() = 'service_role'::text);

-- Create trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_reports_updated_at
BEFORE UPDATE ON public.reports
FOR EACH ROW
EXECUTE FUNCTION public.update_reports_updated_at();

-- Helper function to generate ISO week key
CREATE OR REPLACE FUNCTION public.generate_week_key(input_date DATE)
RETURNS TEXT AS $$
BEGIN
  RETURN EXTRACT(YEAR FROM input_date) || '-W' || 
         LPAD(EXTRACT(WEEK FROM input_date)::TEXT, 2, '0');
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- Helper function to get week boundaries
CREATE OR REPLACE FUNCTION public.get_week_boundaries(input_date DATE)
RETURNS TABLE(week_start DATE, week_end DATE) AS $$
DECLARE
  week_start_date DATE;
  week_end_date DATE;
BEGIN
  -- Get Monday of the week containing input_date
  week_start_date := input_date - EXTRACT(DOW FROM input_date)::INTEGER + 1;
  -- If input_date is Sunday, go back to previous Monday
  IF EXTRACT(DOW FROM input_date) = 0 THEN
    week_start_date := week_start_date - 7;
  END IF;
  
  week_end_date := week_start_date + 6;
  
  RETURN QUERY SELECT week_start_date, week_end_date;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;