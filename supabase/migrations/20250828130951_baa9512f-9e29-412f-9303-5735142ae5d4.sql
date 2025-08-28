-- Create a safer RPC function for marking daily runs with proper NULL handling
CREATE OR REPLACE FUNCTION public.try_mark_daily_run(p_today_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  was_updated boolean := false;
  existing_key text;
BEGIN
  -- Get current state
  SELECT last_daily_run_key INTO existing_key
  FROM scheduler_state 
  WHERE id = 'global';
  
  -- If no record exists, create it
  IF NOT FOUND THEN
    INSERT INTO scheduler_state (id, last_daily_run_key, last_daily_run_at)
    VALUES ('global', p_today_key, now())
    ON CONFLICT (id) DO NOTHING;
    was_updated := true;
  -- If existing key is different or NULL, update it
  ELSIF existing_key IS DISTINCT FROM p_today_key THEN
    UPDATE scheduler_state 
    SET 
      last_daily_run_key = p_today_key,
      last_daily_run_at = now()
    WHERE id = 'global';
    was_updated := true;
  END IF;
  
  RETURN jsonb_build_object(
    'updated', was_updated,
    'previous_key', existing_key,
    'new_key', p_today_key,
    'timestamp', now()
  );
END;
$$;