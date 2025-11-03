-- Create table for visibility report requests
CREATE TABLE IF NOT EXISTS public.visibility_report_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  domain TEXT NOT NULL,
  score INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  report_sent_at TIMESTAMP WITH TIME ZONE
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_visibility_report_requests_email ON public.visibility_report_requests(email);
CREATE INDEX IF NOT EXISTS idx_visibility_report_requests_status ON public.visibility_report_requests(status);
CREATE INDEX IF NOT EXISTS idx_visibility_report_requests_created_at ON public.visibility_report_requests(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.visibility_report_requests ENABLE ROW LEVEL SECURITY;

-- No public access policies since this is admin-only data
-- Service role will handle all operations