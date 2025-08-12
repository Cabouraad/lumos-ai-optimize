-- Fix security issues

-- 1. Add RLS policy for llm_providers (should be readable by all authenticated users)
create policy "Allow authenticated users to read providers" on llm_providers
  for select using (auth.role() = 'authenticated');

-- 2. Fix function search_path security issue
create or replace function prevent_domain_change()
returns trigger 
language plpgsql 
security definer 
set search_path = ''
as $$
begin
  if (old.domain_locked_at is not null) and (new.domain <> old.domain) then
    raise exception 'Domain is locked and cannot be changed';
  end if;
  return new;
end $$;