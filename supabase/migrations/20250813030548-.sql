-- === Fix recursive RLS on users ===

-- Drop any existing recursive/self-joining policies on users
drop policy if exists users_self_org on users;
drop policy if exists users_select_same_org on users;
drop policy if exists users_all on users;

-- Minimal, non-recursive policies:
-- 1) Read: a user can read only their own row
create policy users_read_self
on users
for select
using (id = auth.uid());

-- Intentionally NO client-side insert/update/delete policies.
-- All writes to "users" will be performed by server/service-role only.

-- === Extra hardening ===

-- A) Prevent any non-service-role writes to users table (belt & suspenders)
create or replace function assert_service_for_user_mutations()
returns trigger
language plpgsql
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only service role can modify users';
  end if;
  return new;
end $$;

drop trigger if exists trg_users_write_guard on users;
create trigger trg_users_write_guard
before insert or update or delete on users
for each row execute procedure assert_service_for_user_mutations();

-- B) Normalize organization domain, restrict inserts to service-role,
--    and keep domain lock protection.

-- Normalize domain to lowercase/trim on insert/update
create or replace function normalize_domain()
returns trigger
language plpgsql
as $$
begin
  new.domain := lower(trim(new.domain));
  return new;
end $$;

drop trigger if exists trg_normalize_domain on organizations;
create trigger trg_normalize_domain
before insert or update on organizations
for each row execute procedure normalize_domain();

-- Allow only service-role to INSERT into organizations (onboarding path),
-- updates are still governed by existing owner policy.
create or replace function assert_service_for_org_insert()
returns trigger
language plpgsql
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only service role can insert organizations';
  end if;
  return new;
end $$;

drop trigger if exists trg_org_insert_guard on organizations;
create trigger trg_org_insert_guard
before insert on organizations
for each row execute procedure assert_service_for_org_insert();

-- Keep domain lock guard from earlier migration (recreate to be safe)
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