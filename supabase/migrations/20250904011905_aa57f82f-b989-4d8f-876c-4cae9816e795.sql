-- Enable RLS
alter table public.users enable row level security;

-- Remove any overly-broad policies (safe if they don't exist)
drop policy if exists "users select all" on public.users;

-- Allow each user to read ONLY their own row
create policy "users can select self" on public.users
for select
using ( id = auth.uid() );

-- Optional: future-proof inserts/updates if needed (kept strict)
drop policy if exists "users insert any" on public.users;
drop policy if exists "users update any" on public.users;

-- Keep updates to self only, if you already allow profile edits
create policy if not exists "users can update self" on public.users
for update
using ( id = auth.uid() )
with check ( id = auth.uid() );

-- No changes to service role: it bypasses RLS and will keep working.