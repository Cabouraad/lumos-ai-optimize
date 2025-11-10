-- Add tour completions tracking to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tour_completions jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.users.tour_completions IS 'Tracks which onboarding tours the user has completed (e.g., {"brands": true, "dashboard": true})';