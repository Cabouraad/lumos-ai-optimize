-- Add trial period tracking to subscribers table
ALTER TABLE public.subscribers 
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS payment_collected BOOLEAN DEFAULT false;

-- Update existing starter subscribers to have trial periods if they don't have payment info
UPDATE public.subscribers 
SET 
  trial_started_at = created_at,
  trial_expires_at = created_at + INTERVAL '7 days',
  payment_collected = false
WHERE subscription_tier = 'starter' 
  AND trial_started_at IS NULL 
  AND stripe_customer_id IS NULL;