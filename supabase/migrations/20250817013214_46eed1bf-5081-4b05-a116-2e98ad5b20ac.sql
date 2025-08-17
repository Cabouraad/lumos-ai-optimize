-- Add metadata column to recommendations table for storing recommendation details
ALTER TABLE public.recommendations 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create RPC function for atomic recommendation upsert with cooldown check
CREATE OR REPLACE FUNCTION public.reco_upsert(
  p_org_id UUID,
  p_kind TEXT,
  p_title TEXT,
  p_rationale TEXT,
  p_steps TEXT[],
  p_est_lift NUMERIC,
  p_source_prompt_ids TEXT[],
  p_source_run_ids TEXT[],
  p_citations JSONB,
  p_cooldown_days INTEGER DEFAULT 14
) RETURNS VOID
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
END;
$function$;