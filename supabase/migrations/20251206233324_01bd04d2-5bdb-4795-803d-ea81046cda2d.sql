-- Add public_share_token column to scan_history table for shareable reports
ALTER TABLE public.scan_history 
ADD COLUMN IF NOT EXISTS public_share_token uuid DEFAULT NULL;

-- Create index for efficient token lookups
CREATE INDEX IF NOT EXISTS idx_scan_history_public_share_token 
ON public.scan_history(public_share_token) 
WHERE public_share_token IS NOT NULL;

-- Create RLS policy for public access to shared scans
CREATE POLICY "Anyone can view shared scans" 
ON public.scan_history 
FOR SELECT 
USING (public_share_token IS NOT NULL);