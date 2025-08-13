-- Allow everyone (authenticated) to READ llm_providers
drop policy if exists "Allow authenticated users to read providers" on llm_providers;
create policy llm_providers_read
on llm_providers
for select
using (true);

-- Lock writes to service role only (belt & suspenders)
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

drop trigger if exists trg_llm_providers_write_guard on llm_providers;
create trigger trg_llm_providers_write_guard
before insert or update or delete on llm_providers
for each row execute procedure assert_service_for_llm_provider_mutations();

-- Seed defaults (idempotent)
insert into llm_providers (name, enabled)
values ('openai', true), ('perplexity', true)
on conflict (name) do nothing;