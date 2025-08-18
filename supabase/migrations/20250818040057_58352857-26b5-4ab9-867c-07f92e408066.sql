-- Fix the reco_upsert function by removing transaction control (PostgreSQL handles this automatically)
CREATE OR REPLACE FUNCTION public.reco_upsert(
  p_org_id uuid, 
  p_kind text, 
  p_title text, 
  p_rationale text, 
  p_steps text[], 
  p_est_lift numeric, 
  p_source_prompt_ids text[], 
  p_source_run_ids text[], 
  p_citations jsonb, 
  p_cooldown_days integer DEFAULT 14
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  existing_record RECORD;
  cutoff_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Calculate cutoff date for cooldown check
  cutoff_date := now() - (p_cooldown_days || ' days')::INTERVAL;
  
  -- Check if similar recommendation exists within cooldown period
  SELECT id, created_at INTO existing_record
  FROM recommendations 
  WHERE org_id = p_org_id 
    AND type = p_kind
    AND title = p_title
    AND status IN ('open', 'snoozed')
    AND created_at >= cutoff_date
  LIMIT 1;

  -- If no existing recommendation found, insert new one
  IF existing_record IS NULL THEN
    INSERT INTO recommendations (
      org_id,
      type,
      title,
      rationale,
      status,
      metadata
    ) VALUES (
      p_org_id,
      p_kind,
      p_title,
      p_rationale,
      'open',
      jsonb_build_object(
        'steps', p_steps,
        'estLift', p_est_lift,
        'sourcePromptIds', p_source_prompt_ids,
        'sourceRunIds', p_source_run_ids,
        'citations', p_citations,
        'cooldownDays', p_cooldown_days
      )
    );
    
    RAISE NOTICE 'Created recommendation: %', p_title;
  ELSE
    RAISE NOTICE 'Skipping duplicate recommendation: % (exists since %)', p_title, existing_record.created_at;
  END IF;
  
EXCEPTION 
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in reco_upsert: %', SQLERRM;
    RAISE;
END;
$function$