-- Organizations & users
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text not null unique,
  domain_locked_at timestamptz,
  domain_verification_method text check (domain_verification_method in ('dns','file')),
  plan_tier text not null check (plan_tier in ('starter','pro','scale')),
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  role text not null check (role in ('owner','member')),
  email text not null,
  created_at timestamptz not null default now()
);

-- Providers
create table llm_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (name in ('openai','perplexity')),
  enabled boolean not null default true
);

-- Prompts
create table prompts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  text text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Runs & results
create table prompt_runs (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references prompts(id) on delete cascade,
  run_at timestamptz not null default now(),
  provider_id uuid not null references llm_providers(id) on delete restrict,
  status text not null check (status in ('success','timeout','error')),
  token_in int not null default 0,
  token_out int not null default 0,
  cost_est numeric(10,4) not null default 0
);
create index on prompt_runs (prompt_id, run_at desc);

create table visibility_results (
  id uuid primary key default gen_random_uuid(),
  prompt_run_id uuid not null references prompt_runs(id) on delete cascade,
  org_brand_present boolean not null,
  org_brand_prominence int not null check (org_brand_prominence between 0 and 3),
  brands_json jsonb not null, -- array of strings
  competitors_count int not null default 0,
  raw_evidence text, -- keep short in practice
  score int not null check (score between 0 and 100)
);

-- Brand catalog
create table brand_catalog (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  variants_json jsonb not null default '[]'::jsonb,
  is_org_brand boolean not null default false
);
create index on brand_catalog (org_id, is_org_brand);

-- Recommendations
create table recommendations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  type text not null check (type in ('content','social','site','knowledge')),
  title text not null,
  rationale text not null,
  prompt_ref uuid references prompts(id) on delete set null,
  status text not null default 'open' check (status in ('open','done','ignored')),
  created_at timestamptz not null default now()
);

-- Suggested prompts
create table suggested_prompts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  text text not null,
  source text not null check (source in ('industry','keywords','competitors','trends','gap')),
  created_at timestamptz not null default now(),
  accepted boolean not null default false
);

-- RLS
alter table organizations enable row level security;
alter table users enable row level security;
alter table llm_providers enable row level security;
alter table prompts enable row level security;
alter table prompt_runs enable row level security;
alter table visibility_results enable row level security;
alter table brand_catalog enable row level security;
alter table recommendations enable row level security;
alter table suggested_prompts enable row level security;

-- Basic membership policy: a row belongs to the user's org
create policy org_read on organizations
  for select using (exists (select 1 from users u where u.id = auth.uid() and u.org_id = id));
create policy org_update_owner on organizations
  for update using (exists (select 1 from users u where u.id = auth.uid() and u.org_id = id and u.role='owner'));

create policy users_self_org on users
  for all using (exists (select 1 from users u where u.id = auth.uid() and u.org_id = users.org_id));

create policy table_by_org_read on prompts
  for select using (exists (select 1 from users u where u.id = auth.uid() and u.org_id = prompts.org_id));
create policy table_by_org_all_prompts on prompts
  for all using (exists (select 1 from users u where u.id = auth.uid() and u.org_id = prompts.org_id and u.role in ('owner')));

create policy table_by_org_read_runs on prompt_runs
  for select using (exists (select 1 from prompts p join users u on u.org_id=p.org_id where u.id=auth.uid() and p.id=prompt_runs.prompt_id));
create policy table_by_org_read_results on visibility_results
  for select using (exists (select 1 from prompt_runs r join prompts p on p.id=r.prompt_id join users u on u.org_id=p.org_id where u.id=auth.uid() and r.id=visibility_results.prompt_run_id));

create policy table_by_org_all_brand on brand_catalog
  for all using (exists (select 1 from users u where u.id = auth.uid() and u.org_id = brand_catalog.org_id and u.role in ('owner')));

create policy table_by_org_read_recs on recommendations
  for select using (exists (select 1 from users u where u.id = auth.uid() and u.org_id = recommendations.org_id));
create policy table_by_org_all_recs on recommendations
  for all using (exists (select 1 from users u where u.id = auth.uid() and u.org_id = recommendations.org_id and u.role in ('owner')));

create policy table_by_org_read_sugg on suggested_prompts
  for select using (exists (select 1 from users u where u.id = auth.uid() and u.org_id = suggested_prompts.org_id));
create policy table_by_org_all_sugg on suggested_prompts
  for all using (exists (select 1 from users u where u.id = auth.uid() and u.org_id = suggested_prompts.org_id and u.role in ('owner')));

-- Domain lock trigger: once domain_locked_at is set, domain cannot change
create or replace function prevent_domain_change()
returns trigger language plpgsql as $$
begin
  if (old.domain_locked_at is not null) and (new.domain <> old.domain) then
    raise exception 'Domain is locked and cannot be changed';
  end if;
  return new;
end $$;

drop trigger if exists trg_prevent_domain_change on organizations;
create trigger trg_prevent_domain_change
  before update on organizations
  for each row
  execute procedure prevent_domain_change();

-- Insert default LLM providers
insert into llm_providers (name, enabled) values 
  ('openai', true),
  ('perplexity', true);