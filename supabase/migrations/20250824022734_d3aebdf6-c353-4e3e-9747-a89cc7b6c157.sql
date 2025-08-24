-- Create the provider-level persistence table used by execute-prompt
CREATE TABLE IF NOT EXISTS public.prompt_provider_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  prompt_id uuid NOT NULL,
  provider text NOT NULL,
  model text,
  status text NOT NULL,
  run_at timestamptz NOT NULL DEFAULT now(),
  -- visibility fields
  score integer NOT NULL DEFAULT 0,
  org_brand_present boolean NOT NULL DEFAULT false,
  org_brand_prominence integer,
  competitors_count integer NOT NULL DEFAULT 0,
  brands_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  competitors_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- raw/debug
  raw_ai_response text,
  raw_evidence text,
  error text,
  token_in integer NOT NULL DEFAULT 0,
  token_out integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.prompt_provider_responses ENABLE ROW LEVEL SECURITY;

-- Service can write (insert/update/delete) - used by edge functions with service role
CREATE POLICY "ppr_service_insert"
ON public.prompt_provider_responses
FOR INSERT
TO public
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "ppr_service_update"
ON public.prompt_provider_responses
FOR UPDATE
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "ppr_service_delete"
ON public.prompt_provider_responses
FOR DELETE
TO public
USING (auth.role() = 'service_role');

-- Org members can read rows for their org
CREATE POLICY "ppr_select_by_org"
ON public.prompt_provider_responses
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.org_id = prompt_provider_responses.org_id
  )
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_ppr_prompt_run_at ON public.prompt_provider_responses (prompt_id, run_at DESC);
CREATE INDEX IF NOT EXISTS idx_ppr_prompt_provider_run_at ON public.prompt_provider_responses (prompt_id, provider, run_at DESC);
CREATE INDEX IF NOT EXISTS idx_ppr_org ON public.prompt_provider_responses (org_id);

-- Convenience view: latest row per provider per prompt
CREATE OR REPLACE VIEW public.latest_prompt_provider_responses AS
SELECT DISTINCT ON (prompt_id, provider)
  id,
  org_id,
  prompt_id,
  provider,
  model,
  status,
  run_at,
  score,
  org_brand_present,
  org_brand_prominence,
  competitors_count,
  brands_json,
  competitors_json,
  raw_ai_response,
  raw_evidence,
  error,
  token_in,
  token_out,
  metadata
FROM public.prompt_provider_responses
ORDER BY prompt_id, provider, run_at DESC;