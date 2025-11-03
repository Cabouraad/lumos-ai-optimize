-- Add metadata column to visibility_report_requests to store firstName
ALTER TABLE public.visibility_report_requests 
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;