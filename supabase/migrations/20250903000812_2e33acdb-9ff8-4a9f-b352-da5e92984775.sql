-- Weekly reports feature tables and storage setup

-- Create weekly_reports table to track report metadata
CREATE TABLE public.weekly_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  file_path TEXT,
  file_size_bytes INTEGER,
  generated_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(org_id, week_start_date)
);

-- Enable RLS
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;

-- RLS policies for weekly_reports
CREATE POLICY "Users can view their org's weekly reports"
ON public.weekly_reports
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM users u 
  WHERE u.id = auth.uid() AND u.org_id = weekly_reports.org_id
));

CREATE POLICY "Service role can manage weekly reports"
ON public.weekly_reports
FOR ALL
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- Create storage bucket for weekly reports
INSERT INTO storage.buckets (id, name, public) VALUES ('weekly-reports', 'weekly-reports', false);

-- Storage policies for weekly reports
CREATE POLICY "Users can view their org's weekly report files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'weekly-reports' AND
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() AND 
          (storage.foldername(name))[1] = u.org_id::text
  )
);

CREATE POLICY "Service role can manage weekly report files"
ON storage.objects
FOR ALL
USING (bucket_id = 'weekly-reports' AND auth.role() = 'service_role'::text)
WITH CHECK (bucket_id = 'weekly-reports' AND auth.role() = 'service_role'::text);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_weekly_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_weekly_reports_updated_at
BEFORE UPDATE ON public.weekly_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_weekly_reports_updated_at();