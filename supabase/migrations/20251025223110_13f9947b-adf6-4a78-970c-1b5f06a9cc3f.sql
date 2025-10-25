-- Create a server-side batch computation function to update all org Llumos scores without HTTP
-- This avoids cron secrets and ensures ALL users get updated scores daily

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
  -- Loop over orgs that have activity in the last 56 days
  FOR org_rec IN (
    SELECT o.id, o.name
    FROM organizations o
    WHERE EXISTS (
      SELECT 1 FROM prompt_provider_responses ppr
      WHERE ppr.org_id = o.id
        AND ppr.status = 'success'
        AND ppr.run_at >= now() - interval '56 days'
    )
  ) LOOP
    -- Compute org-level score via existing RPC (trusted, encapsulates logic)
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

-- Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove any previous job with same name
SELECT cron.unschedule('compute-daily-llumos-scores')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'compute-daily-llumos-scores');

-- Schedule the SQL function daily at 2 AM UTC
SELECT cron.schedule(
  'compute-daily-llumos-scores',
  '0 2 * * *',
  $$
  SELECT public.compute_daily_llumos_scores();
  $$
);

-- Run once now to backfill
SELECT public.compute_daily_llumos_scores();