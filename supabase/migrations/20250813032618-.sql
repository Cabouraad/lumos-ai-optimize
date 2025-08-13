-- Fix function search path security issue
create or replace function assert_service_for_llm_provider_mutations()
returns trigger 
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only service role can modify llm_providers';
  end if;
  return new;
end $$;