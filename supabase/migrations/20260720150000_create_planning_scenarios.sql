create table if not exists public.planning_scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  type text not null default 'CUSTOM' check (type in ('BASE', 'CUSTOM', 'SYSTEM')),
  is_default boolean not null default false,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.planning_scenario_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id uuid not null references public.planning_scenarios(id) on delete cascade,
  assumption_key text not null,
  override_value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scenario_id, assumption_key)
);

create unique index if not exists planning_scenarios_one_default_idx
  on public.planning_scenarios (user_id)
  where is_default;

create unique index if not exists planning_scenarios_one_active_idx
  on public.planning_scenarios (user_id)
  where is_active;

create index if not exists planning_scenarios_user_updated_idx
  on public.planning_scenarios (user_id, updated_at desc);

create index if not exists planning_scenario_overrides_scenario_idx
  on public.planning_scenario_overrides (scenario_id, assumption_key);

alter table public.planning_scenarios enable row level security;
alter table public.planning_scenario_overrides enable row level security;

drop policy if exists planning_scenarios_select_own on public.planning_scenarios;
create policy planning_scenarios_select_own on public.planning_scenarios
  for select using (auth.uid() = user_id);

drop policy if exists planning_scenarios_insert_own on public.planning_scenarios;
create policy planning_scenarios_insert_own on public.planning_scenarios
  for insert with check (auth.uid() = user_id);

drop policy if exists planning_scenarios_update_own on public.planning_scenarios;
create policy planning_scenarios_update_own on public.planning_scenarios
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists planning_scenarios_delete_own on public.planning_scenarios;
create policy planning_scenarios_delete_own on public.planning_scenarios
  for delete using (auth.uid() = user_id);

drop policy if exists planning_scenario_overrides_select_own on public.planning_scenario_overrides;
create policy planning_scenario_overrides_select_own on public.planning_scenario_overrides
  for select using (auth.uid() = user_id);

drop policy if exists planning_scenario_overrides_insert_own on public.planning_scenario_overrides;
create policy planning_scenario_overrides_insert_own on public.planning_scenario_overrides
  for insert with check (auth.uid() = user_id);

drop policy if exists planning_scenario_overrides_update_own on public.planning_scenario_overrides;
create policy planning_scenario_overrides_update_own on public.planning_scenario_overrides
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists planning_scenario_overrides_delete_own on public.planning_scenario_overrides;
create policy planning_scenario_overrides_delete_own on public.planning_scenario_overrides
  for delete using (auth.uid() = user_id);

drop trigger if exists planning_scenarios_set_updated_at on public.planning_scenarios;
create trigger planning_scenarios_set_updated_at
before update on public.planning_scenarios
for each row
execute function public.handle_updated_at();

drop trigger if exists planning_scenario_overrides_set_updated_at on public.planning_scenario_overrides;
create trigger planning_scenario_overrides_set_updated_at
before update on public.planning_scenario_overrides
for each row
execute function public.handle_updated_at();
