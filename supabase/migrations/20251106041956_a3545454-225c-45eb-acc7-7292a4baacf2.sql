-- 1. Add BEFORE INSERT trigger on brand_catalog to enforce 50 competitor limit
CREATE OR REPLACE FUNCTION public.enforce_competitor_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  competitor_count integer;
BEGIN
  -- Only enforce for non-org brands
  IF NEW.is_org_brand = false THEN
    SELECT COUNT(*)
    INTO competitor_count
    FROM brand_catalog
    WHERE org_id = NEW.org_id
      AND is_org_brand = false;
    
    IF competitor_count >= 50 THEN
      RAISE EXCEPTION 'Competitor limit reached (50 max). Please remove existing competitors before adding new ones.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_competitor_limit_trigger ON public.brand_catalog;

CREATE TRIGGER enforce_competitor_limit_trigger
  BEFORE INSERT ON public.brand_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_competitor_limit();

-- 2. Add unique index to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS ux_brand_catalog_org_name 
  ON public.brand_catalog (org_id, lower(trim(name))) 
  WHERE is_org_brand = false;

-- 3. Update clean_competitor_catalog to consider status IN ('completed','success')
CREATE OR REPLACE FUNCTION public.clean_competitor_catalog(p_org_id uuid, p_days integer DEFAULT 90)
RETURNS TABLE(removed_count integer, kept_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_removed_count integer := 0;
  v_kept_count integer := 0;
BEGIN
  -- Delete competitors that haven't been seen in recent responses
  WITH recent_competitors AS (
    SELECT DISTINCT LOWER(TRIM(jsonb_array_elements_text(competitors_json))) as competitor_name
    FROM prompt_provider_responses
    WHERE org_id = p_org_id
      AND status IN ('completed', 'success')
      AND run_at >= now() - (p_days || ' days')::interval
      AND competitors_json IS NOT NULL
      AND jsonb_array_length(competitors_json) > 0
  )
  DELETE FROM brand_catalog
  WHERE org_id = p_org_id
    AND is_org_brand = false
    AND LOWER(TRIM(name)) NOT IN (SELECT competitor_name FROM recent_competitors)
  RETURNING 1 INTO v_removed_count;
  
  GET DIAGNOSTICS v_removed_count = ROW_COUNT;
  
  SELECT COUNT(*)::integer INTO v_kept_count
  FROM brand_catalog
  WHERE org_id = p_org_id
    AND is_org_brand = false;
  
  RETURN QUERY SELECT v_removed_count, v_kept_count;
END;
$$;

-- 4. Update process_citation_sources trigger to handle both formats
CREATE OR REPLACE FUNCTION public.process_citation_sources()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  citation jsonb;
  citations_array jsonb;
  citation_url text;
  citation_domain text;
  source_domain text;
  tracked_date date;
BEGIN
  -- Only process if citations exist
  IF NEW.citations_json IS NOT NULL THEN
    tracked_date := DATE(NEW.run_at);
    
    -- Handle both legacy (array) and current (object with citations field) formats
    IF jsonb_typeof(NEW.citations_json) = 'array' THEN
      citations_array := NEW.citations_json;
    ELSIF jsonb_typeof(NEW.citations_json) = 'object' AND NEW.citations_json ? 'citations' THEN
      citations_array := NEW.citations_json->'citations';
    ELSE
      RETURN NEW;
    END IF;
    
    -- Ensure citations_array is actually an array
    IF citations_array IS NOT NULL AND jsonb_typeof(citations_array) = 'array' AND jsonb_array_length(citations_array) > 0 THEN
      -- Loop through each citation
      FOR citation IN SELECT * FROM jsonb_array_elements(citations_array)
      LOOP
        -- Try to get domain directly from citation, otherwise extract from URL
        citation_domain := citation->>'domain';
        
        IF citation_domain IS NULL OR citation_domain = '' THEN
          citation_url := citation->>'url';
          IF citation_url IS NOT NULL AND citation_url != '' THEN
            citation_domain := extract_domain(citation_url);
          END IF;
        END IF;
        
        -- Clean and validate domain
        source_domain := lower(trim(citation_domain));
        
        IF source_domain IS NOT NULL AND source_domain != '' AND length(source_domain) > 2 THEN
          -- Insert or update source tracking with brand_id
          INSERT INTO public.ai_sources (org_id, domain, frequency, model, date_tracked, timestamp, brand_id)
          VALUES (NEW.org_id, source_domain, 1, NEW.model, tracked_date, NEW.run_at, NEW.brand_id)
          ON CONFLICT (org_id, domain, date_tracked, model, COALESCE(brand_id::text, 'null'))
          DO UPDATE SET 
            frequency = ai_sources.frequency + 1,
            updated_at = now();
        END IF;
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 5. Drop and recreate get_competitor_trends RPC with correct signature
DROP FUNCTION IF EXISTS public.get_competitor_trends(uuid,text,integer,integer,uuid);

CREATE FUNCTION public.get_competitor_trends(
  p_org_id uuid,
  p_interval text DEFAULT 'week',
  p_days integer DEFAULT 90,
  p_limit integer DEFAULT 5,
  p_brand_id uuid DEFAULT NULL
)
RETURNS TABLE(
  period_start timestamp with time zone,
  competitor_name text,
  mentions_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_interval text;
  v_days integer;
  v_limit integer;
BEGIN
  -- Validate and normalize inputs
  v_interval := CASE 
    WHEN lower(p_interval) IN ('week', 'month') THEN lower(p_interval)
    ELSE 'week'
  END;
  
  v_days := LEAST(GREATEST(COALESCE(p_days, 90), 7), 365);
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 5), 1), 10);
  
  RETURN QUERY
  WITH expanded_competitors AS (
    SELECT 
      date_trunc(v_interval, ppr.run_at) as period,
      lower(trim(jsonb_array_elements_text(ppr.competitors_json))) as competitor
    FROM prompt_provider_responses ppr
    WHERE ppr.org_id = p_org_id
      AND ppr.status IN ('completed', 'success')
      AND ppr.run_at >= now() - (v_days || ' days')::interval
      AND (p_brand_id IS NULL OR ppr.brand_id = p_brand_id OR ppr.brand_id IS NULL)
      AND ppr.competitors_json IS NOT NULL
      AND jsonb_array_length(ppr.competitors_json) > 0
  ),
  competitor_totals AS (
    SELECT 
      competitor,
      COUNT(*) as total_mentions
    FROM expanded_competitors
    GROUP BY competitor
    ORDER BY total_mentions DESC
    LIMIT v_limit
  ),
  top_competitors AS (
    SELECT competitor FROM competitor_totals
  )
  SELECT 
    ec.period as period_start,
    ec.competitor as competitor_name,
    COUNT(*)::bigint as mentions_count
  FROM expanded_competitors ec
  WHERE ec.competitor IN (SELECT competitor FROM top_competitors)
  GROUP BY ec.period, ec.competitor
  ORDER BY ec.period ASC, mentions_count DESC;
END;
$$;