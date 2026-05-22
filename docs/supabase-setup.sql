create table if not exists public.user_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_states enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update on table public.user_states to authenticated;

drop policy if exists "user can read own state" on public.user_states;
create policy "user can read own state"
on public.user_states
for select
using (auth.uid() = user_id);

drop policy if exists "user can insert own state" on public.user_states;
create policy "user can insert own state"
on public.user_states
for insert
with check (auth.uid() = user_id);

drop policy if exists "user can update own state" on public.user_states;
create policy "user can update own state"
on public.user_states
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
