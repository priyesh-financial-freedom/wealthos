create table if not exists public.planning_assumptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id uuid references public.planning_scenarios(id) on delete cascade,
  goal_id uuid references public.financial_goals(id) on delete cascade,
  current_age integer,
  retirement_age integer,
  life_expectancy integer,
  spouse_life_expectancy integer,
  salary_growth_rate numeric(8, 4),
  bonus_growth_rate numeric(8, 4),
  business_income_growth numeric(8, 4),
  rental_income_growth numeric(8, 4),
  other_income_growth numeric(8, 4),
  general_inflation numeric(8, 4),
  medical_inflation numeric(8, 4),
  education_inflation numeric(8, 4),
  lifestyle_inflation numeric(8, 4),
  property_inflation numeric(8, 4),
  luxury_inflation numeric(8, 4),
  equity_return numeric(8, 4),
  debt_return numeric(8, 4),
  gold_return numeric(8, 4),
  silver_return numeric(8, 4),
  real_estate_return numeric(8, 4),
  cash_return numeric(8, 4),
  epf_return numeric(8, 4),
  ppf_return numeric(8, 4),
  nps_equity_return numeric(8, 4),
  nps_debt_return numeric(8, 4),
  home_loan_interest numeric(8, 4),
  car_loan_interest numeric(8, 4),
  personal_loan_interest numeric(8, 4),
  loan_prepayment_strategy text check (loan_prepayment_strategy in ('NONE', 'AVALANCHE', 'SNOWBALL', 'HYBRID')),
  income_tax_rate numeric(8, 4),
  capital_gains_tax numeric(8, 4),
  dividend_tax numeric(8, 4),
  rental_tax_rate numeric(8, 4),
  withdrawal_rate numeric(8, 4),
  retirement_expense_ratio numeric(8, 4),
  legacy_target numeric(18, 2),
  emergency_corpus_months integer,
  goal_funding_priority text check (goal_funding_priority in ('LOW', 'MEDIUM', 'HIGH')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planning_assumptions_scope_check check (not (scenario_id is not null and goal_id is not null))
);

create unique index if not exists planning_assumptions_user_defaults_idx
  on public.planning_assumptions (user_id)
  where scenario_id is null and goal_id is null;

create unique index if not exists planning_assumptions_scenario_idx
  on public.planning_assumptions (scenario_id)
  where scenario_id is not null and goal_id is null;

create unique index if not exists planning_assumptions_goal_idx
  on public.planning_assumptions (goal_id)
  where goal_id is not null;

create index if not exists planning_assumptions_user_updated_idx
  on public.planning_assumptions (user_id, updated_at desc);

alter table public.planning_assumptions enable row level security;

drop policy if exists planning_assumptions_select_own on public.planning_assumptions;
create policy planning_assumptions_select_own on public.planning_assumptions
  for select using (auth.uid() = user_id);

drop policy if exists planning_assumptions_insert_own on public.planning_assumptions;
create policy planning_assumptions_insert_own on public.planning_assumptions
  for insert with check (auth.uid() = user_id);

drop policy if exists planning_assumptions_update_own on public.planning_assumptions;
create policy planning_assumptions_update_own on public.planning_assumptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists planning_assumptions_delete_own on public.planning_assumptions;
create policy planning_assumptions_delete_own on public.planning_assumptions
  for delete using (auth.uid() = user_id);

drop trigger if exists planning_assumptions_set_updated_at on public.planning_assumptions;
create trigger planning_assumptions_set_updated_at
before update on public.planning_assumptions
for each row
execute function public.handle_updated_at();