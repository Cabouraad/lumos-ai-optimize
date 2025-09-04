-- Fix security definer issue by recreating view with explicit security invoker
drop view if exists public.subscriber_public;

-- Create view with explicit SECURITY INVOKER (default behavior)
-- This ensures the view uses the permissions of the user querying it, not the creator
create view public.subscriber_public 
with (security_invoker=true) as
select 
  user_id,
  subscription_tier as plan,
  case 
    when subscribed = true then 'active'
    when trial_expires_at > now() then 'trial'
    else 'inactive'
  end as status,
  trial_expires_at,
  payment_collected,
  subscription_end as current_period_end,
  created_at,
  updated_at
from public.subscribers;

-- Grant select permissions to authenticated and anon roles
-- RLS from underlying subscribers table still applies
grant select on public.subscriber_public to authenticated, anon;

-- Add helpful comment
comment on view public.subscriber_public is 
'Public view of subscriber data excluding sensitive Stripe fields. Uses security_invoker to ensure proper RLS enforcement.';