-- Create webhook events table for idempotency
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Service role only policy (webhooks don't have user context)
CREATE POLICY "Service role only" ON public.webhook_events
FOR ALL USING (auth.role() = 'service_role');

-- Add missing columns to subscribers table safely
ALTER TABLE public.subscribers 
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Create index for webhook lookups
CREATE INDEX IF NOT EXISTS idx_webhook_events_idempotency 
ON public.webhook_events(idempotency_key);

CREATE INDEX IF NOT EXISTS idx_subscribers_stripe_subscription 
ON public.subscribers(stripe_subscription_id) 
WHERE stripe_subscription_id IS NOT NULL;