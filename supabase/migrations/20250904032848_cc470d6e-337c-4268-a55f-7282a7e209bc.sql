-- Fix organization table permissions for auto-fill functionality
-- Grant SELECT to authenticated users (RLS will still enforce owner-only access)
grant select on public.organizations to authenticated;

-- Grant UPDATE to authenticated users (RLS will still enforce owner-only access) 
grant update on public.organizations to authenticated;