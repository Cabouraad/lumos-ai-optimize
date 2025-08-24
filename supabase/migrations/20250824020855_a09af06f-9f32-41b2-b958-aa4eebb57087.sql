
-- Create RPC function to get all prompt responses for a specific prompt
CREATE OR REPLACE FUNCTION get_prompt_responses(p_prompt_id UUID, p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
  id UUID,
  provider TEXT,
  model TEXT,
  status TEXT,
  run_at TIMESTAMPTZ,
  score INTEGER,
  org_brand_present BOOLEAN,
  org_brand_prominence INTEGER,
  competitors_count INTEGER,
  brands_json JSONB,
  competitors_json JSONB,
  raw_ai_response TEXT,
  raw_evidence TEXT,
  error TEXT,
  token_in INTEGER,
  token_out INTEGER,
  metadata JSONB
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    ppr.id,
    ppr.provider,
    ppr.model,
    ppr.status,
    ppr.run_at,
    ppr.score,
    ppr.org_brand_present,
    ppr.org_brand_prominence,
    ppr.competitors_count,
    ppr.brands_json,
    ppr.competitors_json,
    ppr.raw_ai_response,
    ppr.raw_evidence,
    ppr.error,
    ppr.token_in,
    ppr.token_out,
    ppr.metadata
  FROM prompt_provider_responses ppr
  JOIN prompts p ON p.id = ppr.prompt_id
  JOIN users u ON u.org_id = p.org_id
  WHERE ppr.prompt_id = p_prompt_id
    AND u.id = auth.uid()
  ORDER BY ppr.run_at DESC
  LIMIT p_limit;
$$;

-- Create RPC function to get latest prompt responses per provider for a specific prompt
CREATE OR REPLACE FUNCTION get_latest_prompt_responses(p_prompt_id UUID)
RETURNS TABLE (
  id UUID,
  provider TEXT,
  model TEXT,
  status TEXT,
  run_at TIMESTAMPTZ,
  score INTEGER,
  org_brand_present BOOLEAN,
  org_brand_prominence INTEGER,
  competitors_count INTEGER,
  brands_json JSONB,
  competitors_json JSONB,
  raw_ai_response TEXT,
  raw_evidence TEXT,
  error TEXT,
  token_in INTEGER,
  token_out INTEGER,
  metadata JSONB
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT DISTINCT ON (ppr.provider)
    ppr.id,
    ppr.provider,
    ppr.model,
    ppr.status,
    ppr.run_at,
    ppr.score,
    ppr.org_brand_present,
    ppr.org_brand_prominence,
    ppr.competitors_count,
    ppr.brands_json,
    ppr.competitors_json,
    ppr.raw_ai_response,
    ppr.raw_evidence,
    ppr.error,
    ppr.token_in,
    ppr.token_out,
    ppr.metadata
  FROM prompt_provider_responses ppr
  JOIN prompts p ON p.id = ppr.prompt_id
  JOIN users u ON u.org_id = p.org_id
  WHERE ppr.prompt_id = p_prompt_id
    AND u.id = auth.uid()
  ORDER BY ppr.provider, ppr.run_at DESC;
$$;

-- Create RPC function to get prompt responses for multiple prompts (for scores calculation)
CREATE OR REPLACE FUNCTION get_prompt_responses_for_prompts(p_prompt_ids UUID[])
RETURNS TABLE (
  prompt_id UUID,
  score INTEGER,
  org_brand_present BOOLEAN,
  competitors_count INTEGER
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    ppr.prompt_id,
    ppr.score,
    ppr.org_brand_present,
    ppr.competitors_count
  FROM prompt_provider_responses ppr
  JOIN prompts p ON p.id = ppr.prompt_id
  JOIN users u ON u.org_id = p.org_id
  WHERE ppr.prompt_id = ANY(p_prompt_ids)
    AND ppr.status = 'success'
    AND u.id = auth.uid()
  ORDER BY ppr.run_at DESC;
$$;
