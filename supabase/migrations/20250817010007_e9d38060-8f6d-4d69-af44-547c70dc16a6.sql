-- Fix search_path for the scheduler state function (with proper dependency handling)
DROP TRIGGER IF EXISTS update_scheduler_state_updated_at ON public.scheduler_state;
DROP FUNCTION IF EXISTS public.update_scheduler_state_updated_at();

-- Create function with proper security settings
CREATE OR REPLACE FUNCTION public.update_scheduler_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public';

-- Recreate the trigger
CREATE TRIGGER update_scheduler_state_updated_at
  BEFORE UPDATE ON public.scheduler_state
  FOR EACH ROW
  EXECUTE FUNCTION public.update_scheduler_state_updated_at();