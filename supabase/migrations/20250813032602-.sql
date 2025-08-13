-- Read policy so Settings/Prompts/Dashboard can always list providers
drop policy if exists llm_providers_read on llm_providers;
create policy llm_providers_read
on llm_providers
for select
using (true);

-- Service-role write guard (safe even if already present)
create or replace function assert_service_for_llm_provider_mutations()
returns trigger language plpgsql as $$
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

-- Seed defaults (no-ops if they exist)
insert into llm_providers (name, enabled)
values ('openai', true), ('perplexity', true)
on conflict (name) do nothing;