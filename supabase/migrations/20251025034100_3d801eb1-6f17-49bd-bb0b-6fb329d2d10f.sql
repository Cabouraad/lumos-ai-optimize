
-- Disable trigger temporarily to avoid conflicts
ALTER TABLE prompt_provider_responses DISABLE TRIGGER auto_populate_brand_catalog_trigger;

-- Recalculate scores: brand not present should be 0, not 1
UPDATE prompt_provider_responses
SET score = 0,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'score_recalculated', true,
      'score_recalculated_at', NOW(),
      'reason', 'Fixed scoring: brand not present should be 0, not 1'
    )
WHERE status = 'success'
  AND org_brand_present = false
  AND score = 1
  AND run_at >= NOW() - INTERVAL '90 days';

-- Re-enable trigger
ALTER TABLE prompt_provider_responses ENABLE TRIGGER auto_populate_brand_catalog_trigger;
