-- Create RPC function for smart keyword scanning prioritization
CREATE OR REPLACE FUNCTION public.get_keywords_due_for_scan(p_limit integer DEFAULT 50)
RETURNS TABLE(
  keyword_id uuid,
  keyword text,
  platform text,
  user_id uuid,
  org_id uuid,
  subscription_tier text,
  last_scanned_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tk.id as keyword_id,
    tk.keyword,
    tk.platform,
    tk.user_id,
    tk.org_id,
    COALESCE(s.subscription_tier, 'free') as subscription_tier,
    tk.last_scanned_at
  FROM tracked_keywords tk
  INNER JOIN users u ON u.id = tk.user_id
  LEFT JOIN subscribers s ON s.user_id = tk.user_id
  WHERE tk.is_active = true
    AND (
      -- Premium/Agency: scan if older than 24 hours or never scanned
      (
        COALESCE(s.subscription_tier, 'free') IN ('pro', 'growth', 'premium', 'agency', 'enterprise')
        AND (tk.last_scanned_at IS NULL OR tk.last_scanned_at < NOW() - INTERVAL '24 hours')
      )
      OR
      -- Starter: scan if older than 3 days or never scanned
      (
        COALESCE(s.subscription_tier, 'free') = 'starter'
        AND (tk.last_scanned_at IS NULL OR tk.last_scanned_at < NOW() - INTERVAL '3 days')
      )
      OR
      -- Free: scan if older than 7 days or never scanned
      (
        COALESCE(s.subscription_tier, 'free') = 'free'
        AND (tk.last_scanned_at IS NULL OR tk.last_scanned_at < NOW() - INTERVAL '7 days')
      )
    )
  ORDER BY tk.last_scanned_at ASC NULLS FIRST
  LIMIT p_limit;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_keywords_due_for_scan(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_keywords_due_for_scan(integer) TO service_role;