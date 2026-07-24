create table if not exists public.planning_family_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  primary_date_of_birth date,
  spouse_date_of_birth date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists planning_family_profiles_updated_idx
  on public.planning_family_profiles (updated_at desc);

alter table public.planning_family_profiles enable row level security;

drop policy if exists planning_family_profiles_select_own on public.planning_family_profiles;
create policy planning_family_profiles_select_own on public.planning_family_profiles
  for select using (auth.uid() = user_id);

drop policy if exists planning_family_profiles_insert_own on public.planning_family_profiles;
create policy planning_family_profiles_insert_own on public.planning_family_profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists planning_family_profiles_update_own on public.planning_family_profiles;
create policy planning_family_profiles_update_own on public.planning_family_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists planning_family_profiles_delete_own on public.planning_family_profiles;
create policy planning_family_profiles_delete_own on public.planning_family_profiles
  for delete using (auth.uid() = user_id);

drop trigger if exists planning_family_profiles_set_updated_at on public.planning_family_profiles;
create trigger planning_family_profiles_set_updated_at
before update on public.planning_family_profiles
for each row
execute function public.handle_updated_at();
