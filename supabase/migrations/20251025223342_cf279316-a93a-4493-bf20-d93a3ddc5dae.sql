-- Expand daily computation to ALL organizations (not just active ones)
CREATE OR REPLACE FUNCTION public.compute_daily_llumos_scores()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  org_rec RECORD;
  rpc_result jsonb;
  v_window_start timestamptz;
  updated_count int;
BEGIN
  FOR org_rec IN (
    SELECT o.id, o.name
    FROM organizations o
  ) LOOP
    -- Compute org-level score via existing RPC; returns 'insufficient_data' when needed
    SELECT public.compute_llumos_score(org_rec.id, NULL) INTO rpc_result;

    IF rpc_result IS NULL THEN
      CONTINUE;
    END IF;

    v_window_start := (rpc_result -> 'window' ->> 'start')::timestamptz;

    -- Try update first
    UPDATE public.llumos_scores ls
    SET 
      composite = (rpc_result ->> 'composite')::numeric,
      llumos_score = (rpc_result ->> 'score')::int,
      submetrics = (rpc_result -> 'submetrics'),
      window_end = (rpc_result -> 'window' ->> 'end')::timestamptz,
      reason = (rpc_result ->> 'reason')
    WHERE ls.org_id = org_rec.id
      AND ls.scope = 'org'
      AND ls.prompt_id IS NULL
      AND ls.window_start = v_window_start;

    GET DIAGNOSTICS updated_count = ROW_COUNT;

    IF updated_count = 0 THEN
      -- Insert if no existing row
      INSERT INTO public.llumos_scores (
        org_id, prompt_id, scope, composite, llumos_score, submetrics,
        window_start, window_end, reason
      ) VALUES (
        org_rec.id,
        NULL,
        'org',
        (rpc_result ->> 'composite')::numeric,
        (rpc_result ->> 'score')::int,
        (rpc_result -> 'submetrics'),
        (rpc_result -> 'window' ->> 'start')::timestamptz,
        (rpc_result -> 'window' ->> 'end')::timestamptz,
        (rpc_result ->> 'reason')
      );
    END IF;
  END LOOP;
END;
$$;

-- Run once now to backfill for orgs without any recent activity
SELECT public.compute_daily_llumos_scores();