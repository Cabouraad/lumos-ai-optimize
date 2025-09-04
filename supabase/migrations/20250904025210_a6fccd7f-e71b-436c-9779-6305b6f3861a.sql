-- Create public view for subscriber data without sensitive fields
-- Maps to actual column names in subscribers table
create view public.subscriber_public as
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
'Public view of subscriber data excluding sensitive Stripe fields. RLS policies from subscribers table still apply.';