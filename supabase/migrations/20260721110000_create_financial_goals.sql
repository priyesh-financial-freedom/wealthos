create table if not exists public.financial_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  goal_type text not null check (goal_type in ('RETIREMENT', 'EDUCATION', 'HOME_PURCHASE', 'WEALTH_TARGET', 'CUSTOM')),
  target_amount numeric(14,2) not null check (target_amount >= 0),
  target_date date not null,
  priority text not null default 'MEDIUM' check (priority in ('LOW', 'MEDIUM', 'HIGH')),
  status text not null default 'NOT_STARTED' check (status in ('NOT_STARTED', 'ON_TRACK', 'NEEDS_ATTENTION', 'AT_RISK', 'COMPLETED')),
  funding_source text,
  linked_scenario_id uuid references public.planning_scenarios(id) on delete set null,
  notes text,
  is_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists financial_goals_user_updated_idx
  on public.financial_goals (user_id, updated_at desc);

create index if not exists financial_goals_user_status_idx
  on public.financial_goals (user_id, status);

create index if not exists financial_goals_linked_scenario_idx
  on public.financial_goals (linked_scenario_id);

alter table public.financial_goals enable row level security;

drop policy if exists financial_goals_select_own on public.financial_goals;
create policy financial_goals_select_own on public.financial_goals
  for select using (auth.uid() = user_id);

drop policy if exists financial_goals_insert_own on public.financial_goals;
create policy financial_goals_insert_own on public.financial_goals
  for insert with check (auth.uid() = user_id);

drop policy if exists financial_goals_update_own on public.financial_goals;
create policy financial_goals_update_own on public.financial_goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists financial_goals_delete_own on public.financial_goals;
create policy financial_goals_delete_own on public.financial_goals
  for delete using (auth.uid() = user_id);

drop trigger if exists financial_goals_set_updated_at on public.financial_goals;
create trigger financial_goals_set_updated_at
before update on public.financial_goals
for each row
execute function public.handle_updated_at();
