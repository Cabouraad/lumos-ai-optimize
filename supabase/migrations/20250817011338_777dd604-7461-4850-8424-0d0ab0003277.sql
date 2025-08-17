-- Check if scheduler_state table exists and create if not
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'scheduler_state') THEN
        -- Create table if it doesn't exist
        CREATE TABLE public.scheduler_state (
            id text PRIMARY KEY DEFAULT 'global',
            last_daily_run_key text,
            last_daily_run_at timestamptz,
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now()
        );
        
        -- Enable RLS
        ALTER TABLE public.scheduler_state ENABLE ROW LEVEL SECURITY;
    END IF;
END
$$;

-- Ensure the touch_updated_at function exists
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Ensure trigger exists
DROP TRIGGER IF EXISTS trg_scheduler_state_updated_at ON public.scheduler_state;
CREATE TRIGGER trg_scheduler_state_updated_at
BEFORE UPDATE ON public.scheduler_state
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Ensure policy exists (drop and recreate to avoid conflicts)
DROP POLICY IF EXISTS scheduler_state_service_access ON public.scheduler_state;
CREATE POLICY scheduler_state_service_access 
ON public.scheduler_state 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Seed the global row if it doesn't exist
INSERT INTO public.scheduler_state (id)
VALUES ('global')
ON CONFLICT (id) DO NOTHING;