create table if not exists public.assumption_categories (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key in (
    'INCOME',
    'INFLATION',
    'INVESTMENT_RETURNS',
    'RETIREMENT',
    'TAX',
    'LOANS',
    'EMERGENCY_PLANNING',
    'MARKET'
  )),
  name text not null,
  description text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assumptions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.assumption_categories(id) on delete cascade,
  key text not null unique,
  name text not null,
  description text,
  data_type text not null check (data_type in ('NUMBER', 'PERCENTAGE', 'CURRENCY', 'INTEGER', 'BOOLEAN', 'TEXT', 'MONTH', 'ENUM')),
  unit text,
  default_value jsonb not null,
  minimum_value numeric,
  maximum_value numeric,
  help_text text,
  is_required boolean not null default true,
  is_active boolean not null default true,
  is_advanced_only boolean not null default false,
  allowed_values jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, key)
);

create table if not exists public.assumption_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  is_default boolean not null default false,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assumption_values (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.assumption_profiles(id) on delete cascade,
  assumption_id uuid not null references public.assumptions(id) on delete cascade,
  value jsonb not null,
  source text not null default 'USER' check (source in ('SYSTEM', 'USER', 'IMPORTED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, assumption_id)
);

create table if not exists public.policy_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.assumption_profiles(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  version_name text not null,
  notes text,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, version_number)
);

create unique index if not exists assumption_profiles_one_default_idx
  on public.assumption_profiles (user_id)
  where is_default;

create unique index if not exists assumption_profiles_one_active_idx
  on public.assumption_profiles (user_id)
  where is_active;

create index if not exists assumption_profiles_user_updated_idx
  on public.assumption_profiles (user_id, updated_at desc);

create index if not exists assumptions_category_active_idx
  on public.assumptions (category_id, is_active, name);

create index if not exists assumption_values_profile_idx
  on public.assumption_values (profile_id, assumption_id);

create index if not exists policy_versions_profile_created_idx
  on public.policy_versions (profile_id, version_number desc);

alter table public.assumption_categories enable row level security;
alter table public.assumptions enable row level security;
alter table public.assumption_profiles enable row level security;
alter table public.assumption_values enable row level security;
alter table public.policy_versions enable row level security;

drop policy if exists assumption_categories_select_authenticated on public.assumption_categories;
create policy assumption_categories_select_authenticated on public.assumption_categories
  for select using (auth.role() = 'authenticated');

drop policy if exists assumptions_select_authenticated on public.assumptions;
create policy assumptions_select_authenticated on public.assumptions
  for select using (auth.role() = 'authenticated');

drop policy if exists assumption_profiles_select_own on public.assumption_profiles;
create policy assumption_profiles_select_own on public.assumption_profiles
  for select using (auth.uid() = user_id);

drop policy if exists assumption_profiles_insert_own on public.assumption_profiles;
create policy assumption_profiles_insert_own on public.assumption_profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists assumption_profiles_update_own on public.assumption_profiles;
create policy assumption_profiles_update_own on public.assumption_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists assumption_profiles_delete_own on public.assumption_profiles;
create policy assumption_profiles_delete_own on public.assumption_profiles
  for delete using (auth.uid() = user_id);

drop policy if exists assumption_values_select_own on public.assumption_values;
create policy assumption_values_select_own on public.assumption_values
  for select using (auth.uid() = user_id);

drop policy if exists assumption_values_insert_own on public.assumption_values;
create policy assumption_values_insert_own on public.assumption_values
  for insert with check (auth.uid() = user_id);

drop policy if exists assumption_values_update_own on public.assumption_values;
create policy assumption_values_update_own on public.assumption_values
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists assumption_values_delete_own on public.assumption_values;
create policy assumption_values_delete_own on public.assumption_values
  for delete using (auth.uid() = user_id);

drop policy if exists policy_versions_select_own on public.policy_versions;
create policy policy_versions_select_own on public.policy_versions
  for select using (auth.uid() = user_id);

drop policy if exists policy_versions_insert_own on public.policy_versions;
create policy policy_versions_insert_own on public.policy_versions
  for insert with check (auth.uid() = user_id);

drop policy if exists policy_versions_update_own on public.policy_versions;
create policy policy_versions_update_own on public.policy_versions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists policy_versions_delete_own on public.policy_versions;
create policy policy_versions_delete_own on public.policy_versions
  for delete using (auth.uid() = user_id);

drop trigger if exists assumption_categories_set_updated_at on public.assumption_categories;
create trigger assumption_categories_set_updated_at
before update on public.assumption_categories
for each row
execute function public.handle_updated_at();

drop trigger if exists assumptions_set_updated_at on public.assumptions;
create trigger assumptions_set_updated_at
before update on public.assumptions
for each row
execute function public.handle_updated_at();

drop trigger if exists assumption_profiles_set_updated_at on public.assumption_profiles;
create trigger assumption_profiles_set_updated_at
before update on public.assumption_profiles
for each row
execute function public.handle_updated_at();

drop trigger if exists assumption_values_set_updated_at on public.assumption_values;
create trigger assumption_values_set_updated_at
before update on public.assumption_values
for each row
execute function public.handle_updated_at();

drop trigger if exists policy_versions_set_updated_at on public.policy_versions;
create trigger policy_versions_set_updated_at
before update on public.policy_versions
for each row
execute function public.handle_updated_at();

insert into public.assumption_categories (key, name, description, display_order)
values
  ('INCOME', 'Income', 'Salary growth, bonus and income persistence assumptions.', 10),
  ('INFLATION', 'Inflation', 'Inflation assumptions used for expense and goal projections.', 20),
  ('INVESTMENT_RETURNS', 'Investment Returns', 'Expected return assumptions across asset classes.', 30),
  ('RETIREMENT', 'Retirement', 'Retirement contribution, age and corpus assumptions.', 40),
  ('TAX', 'Tax', 'Policy-level tax assumptions and effective tax rates.', 50),
  ('LOANS', 'Loans', 'Debt cost and repayment assumptions.', 60),
  ('EMERGENCY_PLANNING', 'Emergency Planning', 'Liquidity and emergency reserve assumptions.', 70),
  ('MARKET', 'Market', 'Market scenario and stress assumptions.', 80)
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  display_order = excluded.display_order;

insert into public.assumptions (
  category_id,
  key,
  name,
  description,
  data_type,
  unit,
  default_value,
  minimum_value,
  maximum_value,
  help_text,
  is_required,
  is_active,
  is_advanced_only,
  allowed_values
)
values
  ((select id from public.assumption_categories where key = 'INCOME'), 'income_monthly_salary', 'Monthly Salary', 'Primary monthly salary income.', 'CURRENCY', 'INR', '0'::jsonb, 0, null, 'Monthly in-hand salary before expenses.', true, true, false, null),
  ((select id from public.assumption_categories where key = 'INCOME'), 'income_salary_growth_rate', 'Salary Growth Rate', 'Expected annual salary increment rate.', 'PERCENTAGE', 'PERCENT', '8'::jsonb, 0, 50, 'Annual growth assumption for salary.', true, true, false, null),
  ((select id from public.assumption_categories where key = 'INCOME'), 'income_bonus_amount', 'Annual Bonus Amount', 'Expected annual bonus amount.', 'CURRENCY', 'INR', '0'::jsonb, 0, null, 'Set zero if bonus is not expected.', false, true, true, null),
  ((select id from public.assumption_categories where key = 'INCOME'), 'income_bonus_month', 'Bonus Month', 'Month of annual bonus payout.', 'INTEGER', 'MONTH_NUMBER', '3'::jsonb, 1, 12, 'Used for cashflow timing in simulations.', false, true, true, null),

  ((select id from public.assumption_categories where key = 'INFLATION'), 'inflation_general_rate', 'General Inflation Rate', 'General household inflation assumption.', 'PERCENTAGE', 'PERCENT', '6'::jsonb, 0, 20, 'Base inflation used across projections.', true, true, false, null),
  ((select id from public.assumption_categories where key = 'INFLATION'), 'inflation_healthcare_rate', 'Healthcare Inflation Rate', 'Medical inflation assumption.', 'PERCENTAGE', 'PERCENT', '8'::jsonb, 0, 30, 'Use a higher value if medical risk is elevated.', true, true, true, null),
  ((select id from public.assumption_categories where key = 'INFLATION'), 'inflation_education_rate', 'Education Inflation Rate', 'Education inflation assumption.', 'PERCENTAGE', 'PERCENT', '10'::jsonb, 0, 30, 'Useful for child education goals.', false, true, true, null),

  ((select id from public.assumption_categories where key = 'INVESTMENT_RETURNS'), 'returns_equity_rate', 'Equity Return Rate', 'Expected long-term equity return.', 'PERCENTAGE', 'PERCENT', '12'::jsonb, -20, 40, 'Nominal annual return expectation.', true, true, false, null),
  ((select id from public.assumption_categories where key = 'INVESTMENT_RETURNS'), 'returns_debt_rate', 'Debt Return Rate', 'Expected debt instrument return.', 'PERCENTAGE', 'PERCENT', '7'::jsonb, 0, 25, 'Used for fixed income instruments.', true, true, false, null),
  ((select id from public.assumption_categories where key = 'INVESTMENT_RETURNS'), 'returns_gold_rate', 'Gold Return Rate', 'Expected annual gold appreciation.', 'PERCENTAGE', 'PERCENT', '7'::jsonb, -10, 30, 'Long-term estimate for gold.', false, true, true, null),

  ((select id from public.assumption_categories where key = 'RETIREMENT'), 'retirement_target_age', 'Retirement Target Age', 'Planned retirement age.', 'INTEGER', 'YEARS', '60'::jsonb, 35, 90, 'Age at which retirement planning begins drawdown.', true, true, false, null),
  ((select id from public.assumption_categories where key = 'RETIREMENT'), 'retirement_employee_contribution_rate', 'Employee Contribution Rate', 'Retirement contribution from salary.', 'PERCENTAGE', 'PERCENT', '12'::jsonb, 0, 100, 'Combined EPF or equivalent contribution.', true, true, true, null),
  ((select id from public.assumption_categories where key = 'RETIREMENT'), 'retirement_employer_contribution_rate', 'Employer Contribution Rate', 'Employer-side retirement contribution.', 'PERCENTAGE', 'PERCENT', '12'::jsonb, 0, 100, 'Employer EPF contribution assumption.', false, true, true, null),

  ((select id from public.assumption_categories where key = 'TAX'), 'tax_regime', 'Tax Regime', 'Tax regime applied for policy simulation.', 'ENUM', null, '"new"'::jsonb, null, null, 'Switch between old/new/custom assumptions.', true, true, false, '["new","old","custom"]'::jsonb),
  ((select id from public.assumption_categories where key = 'TAX'), 'tax_effective_rate', 'Effective Tax Rate', 'Effective blended tax rate.', 'PERCENTAGE', 'PERCENT', '12'::jsonb, 0, 60, 'Used for high-level simulation outcomes.', true, true, false, null),

  ((select id from public.assumption_categories where key = 'LOANS'), 'loan_average_interest_rate', 'Average Loan Interest Rate', 'Average weighted loan interest rate.', 'PERCENTAGE', 'PERCENT', '9'::jsonb, 0, 30, 'Weighted average across active loans.', true, true, false, null),
  ((select id from public.assumption_categories where key = 'LOANS'), 'loan_emi_increment_rate', 'EMI Increment Rate', 'Expected EMI step-up percentage.', 'PERCENTAGE', 'PERCENT', '0'::jsonb, 0, 50, 'For loans with periodic step-up payments.', false, true, true, null),
  ((select id from public.assumption_categories where key = 'LOANS'), 'loan_use_extra_cash_for_prepayment', 'Use Extra Cash for Prepayment', 'Whether extra cash should prepay debt.', 'BOOLEAN', null, 'false'::jsonb, null, null, 'Enables prepayment-first strategy.', false, true, false, null),

  ((select id from public.assumption_categories where key = 'EMERGENCY_PLANNING'), 'emergency_fund_months', 'Emergency Fund Months', 'Number of expense months kept as emergency reserve.', 'INTEGER', 'MONTHS', '6'::jsonb, 0, 36, 'Recommended between 3 and 12 months.', true, true, false, null),
  ((select id from public.assumption_categories where key = 'EMERGENCY_PLANNING'), 'emergency_fund_target_amount', 'Emergency Fund Target Amount', 'Absolute emergency fund target amount.', 'CURRENCY', 'INR', '0'::jsonb, 0, null, 'Optional explicit target amount.', false, true, true, null),

  ((select id from public.assumption_categories where key = 'MARKET'), 'market_volatility_regime', 'Volatility Regime', 'Market volatility regime used for stress scenarios.', 'ENUM', null, '"NORMAL"'::jsonb, null, null, 'Used by simulation presets and stress tests.', true, true, false, '["LOW","NORMAL","HIGH"]'::jsonb),
  ((select id from public.assumption_categories where key = 'MARKET'), 'market_drawdown_stress', 'Drawdown Stress', 'One-time market drawdown stress percentage.', 'PERCENTAGE', 'PERCENT', '20'::jsonb, 0, 80, 'Applied during bear-case stress runs.', false, true, true, null)
on conflict (key) do update
set
  category_id = excluded.category_id,
  name = excluded.name,
  description = excluded.description,
  data_type = excluded.data_type,
  unit = excluded.unit,
  default_value = excluded.default_value,
  minimum_value = excluded.minimum_value,
  maximum_value = excluded.maximum_value,
  help_text = excluded.help_text,
  is_required = excluded.is_required,
  is_active = excluded.is_active,
  is_advanced_only = excluded.is_advanced_only,
  allowed_values = excluded.allowed_values;
