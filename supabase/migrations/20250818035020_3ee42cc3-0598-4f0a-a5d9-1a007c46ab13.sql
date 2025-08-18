-- Add indexes for better performance on competitor queries
CREATE INDEX IF NOT EXISTS idx_brand_catalog_org_competitor ON brand_catalog (org_id, is_org_brand) WHERE is_org_brand = false;
CREATE INDEX IF NOT EXISTS idx_brand_catalog_last_seen ON brand_catalog (org_id, last_seen_at);
CREATE INDEX IF NOT EXISTS idx_prompt_runs_prompt_id_run_at ON prompt_runs (prompt_id, run_at DESC);
CREATE INDEX IF NOT EXISTS idx_visibility_results_prompt_run ON visibility_results (prompt_run_id);

-- Add competitor_mentions table for better tracking
CREATE TABLE IF NOT EXISTS public.competitor_mentions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL,
  prompt_id uuid NOT NULL,
  competitor_name text NOT NULL,
  normalized_name text NOT NULL,
  mention_count integer NOT NULL DEFAULT 1,
  average_position numeric,
  sentiment text,
  first_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.competitor_mentions ENABLE ROW LEVEL SECURITY;

-- Create policies for competitor_mentions
CREATE POLICY "Competitor mentions read by org" 
ON public.competitor_mentions 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM users u 
  WHERE u.id = auth.uid() AND u.org_id = competitor_mentions.org_id
));

CREATE POLICY "Competitor mentions all access for owners" 
ON public.competitor_mentions 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM users u 
  WHERE u.id = auth.uid() AND u.org_id = competitor_mentions.org_id AND u.role = 'owner'
));

-- Add trigger for updated_at
CREATE TRIGGER update_competitor_mentions_updated_at
  BEFORE UPDATE ON public.competitor_mentions
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- Create function to upsert competitor mentions
CREATE OR REPLACE FUNCTION public.upsert_competitor_mention(
  p_org_id uuid,
  p_prompt_id uuid,
  p_competitor_name text,
  p_normalized_name text,
  p_position numeric DEFAULT NULL,
  p_sentiment text DEFAULT 'neutral'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  existing_record RECORD;
BEGIN
  -- Check if mention already exists
  SELECT * INTO existing_record
  FROM competitor_mentions 
  WHERE org_id = p_org_id 
    AND prompt_id = p_prompt_id
    AND normalized_name = lower(trim(p_normalized_name));

  IF existing_record IS NOT NULL THEN
    -- Update existing mention
    UPDATE competitor_mentions 
    SET 
      mention_count = mention_count + 1,
      average_position = CASE 
        WHEN p_position IS NOT NULL THEN 
          ((average_position * (mention_count - 1)) + p_position) / mention_count
        ELSE average_position
      END,
      sentiment = p_sentiment,
      last_seen_at = now(),
      updated_at = now()
    WHERE id = existing_record.id;
  ELSE
    -- Insert new mention
    INSERT INTO competitor_mentions (
      org_id,
      prompt_id,
      competitor_name,
      normalized_name,
      mention_count,
      average_position,
      sentiment
    ) VALUES (
      p_org_id,
      p_prompt_id,
      trim(p_competitor_name),
      lower(trim(p_normalized_name)),
      1,
      p_position,
      p_sentiment
    );
  END IF;
END;
$function$