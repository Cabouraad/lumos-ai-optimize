-- Fix search_path for the scheduler state function
DROP FUNCTION IF EXISTS public.update_scheduler_state_updated_at();

CREATE OR REPLACE FUNCTION public.update_scheduler_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public';