-- Fix analytics_events SELECT policy to prevent exposure of anonymous visitor data
-- Current policy allows authenticated users to see ALL events where user_id IS NULL
-- This exposes IP addresses, user agents, page URLs, and referrer information

-- Drop the existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view their own events" ON public.analytics_events;

-- Create a new restrictive SELECT policy that only shows user's own events
-- Users can ONLY see events that are explicitly linked to their user_id
CREATE POLICY "Users can view their own events" ON public.analytics_events
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Note: This change does NOT affect:
-- 1. INSERT - anyone can still insert analytics events (required for tracking)
-- 2. Service role - still has ALL access via existing policy for backend analytics
-- 3. Anonymous event collection - still works, just not visible to regular users

COMMENT ON TABLE public.analytics_events IS 'Analytics events with RLS enabled. Users can only view their own events. Anonymous events (user_id IS NULL) are only accessible via service_role for backend processing.';