-- Add a safe metadata column if it doesn't exist yet (jsonb, nullable)
ALTER TABLE public.subscribers
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Helper partial index for quick lookups by metadata->>'source'
CREATE INDEX IF NOT EXISTS idx_subscribers_metadata_source
  ON public.subscribers ((metadata->>'source'));