-- Fix Critical Security Issues

-- 1. Add RLS policy for the materialized view to restrict access
ALTER TABLE dashboard_performance_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dashboard metrics access by org owners" 
ON dashboard_performance_metrics 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM users u 
  WHERE u.id = auth.uid() 
    AND u.org_id = dashboard_performance_metrics.org_id 
    AND u.role = 'owner'
));

-- 2. Fix function search path security issues
CREATE OR REPLACE FUNCTION refresh_dashboard_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_performance_metrics;
END;
$$;

-- Update other functions to have secure search path
CREATE OR REPLACE FUNCTION update_subscribers_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;