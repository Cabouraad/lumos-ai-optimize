-- Add columns to brand_catalog for competitor tracking
ALTER TABLE public.brand_catalog 
ADD COLUMN IF NOT EXISTS first_detected_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS total_appearances INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS average_score NUMERIC DEFAULT 0;

-- Create index for better performance when querying competitors
CREATE INDEX IF NOT EXISTS idx_brand_catalog_competitors 
ON public.brand_catalog (org_id, is_org_brand, last_seen_at DESC) 
WHERE is_org_brand = false;

-- Create function to upsert competitor brands
CREATE OR REPLACE FUNCTION public.upsert_competitor_brand(
  p_org_id UUID,
  p_brand_name TEXT,
  p_score INTEGER DEFAULT 0
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_record RECORD;
BEGIN
  -- Check if brand already exists
  SELECT * INTO existing_record
  FROM brand_catalog 
  WHERE org_id = p_org_id 
    AND lower(trim(name)) = lower(trim(p_brand_name))
    AND is_org_brand = false;

  IF existing_record IS NOT NULL THEN
    -- Update existing competitor
    UPDATE brand_catalog 
    SET 
      last_seen_at = now(),
      total_appearances = total_appearances + 1,
      average_score = ((average_score * (total_appearances - 1)) + p_score) / total_appearances
    WHERE id = existing_record.id;
  ELSE
    -- Insert new competitor (but check it's not an org brand first)
    IF NOT EXISTS (
      SELECT 1 FROM brand_catalog 
      WHERE org_id = p_org_id 
        AND lower(trim(name)) = lower(trim(p_brand_name))
        AND is_org_brand = true
    ) THEN
      INSERT INTO brand_catalog (
        org_id,
        name,
        is_org_brand,
        variants_json,
        first_detected_at,
        last_seen_at,
        total_appearances,
        average_score
      ) VALUES (
        p_org_id,
        trim(p_brand_name),
        false,
        '[]'::jsonb,
        now(),
        now(),
        1,
        p_score
      );
    END IF;
  END IF;
END;
$$;