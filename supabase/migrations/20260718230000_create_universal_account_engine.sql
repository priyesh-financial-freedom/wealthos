create table if not exists public.universal_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  institution text,
  account_type text not null check (
    account_type in (
      'Savings Account',
      'Salary Account',
      'Current Account',
      'Cash',
      'Wallet',
      'EPF',
      'PPF',
      'NPS',
      'Fixed Deposit',
      'Mutual Fund',
      'Stock Portfolio',
      'Gold',
      'Silver',
      'Bonds',
      'Real Estate',
      'Vehicle',
      'Insurance',
      'Credit Card',
      'Loan'
    )
  ),
  owner text,
  joint_owner text,
  nominee text,
  opening_value numeric(14,2) not null default 0,
  current_value numeric(14,2) not null default 0,
  currency text not null default 'USD',
  purchase_date date,
  interest_rate numeric(7,3),
  maturity_date date,
  status text not null default 'active' check (status in ('active', 'inactive', 'closed', 'archived')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.universal_account_monthly_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  universal_account_id uuid not null references public.universal_accounts(id) on delete cascade,
  snapshot_month integer not null check (snapshot_month between 1 and 12),
  snapshot_year integer not null check (snapshot_year >= 2000),
  opening_value numeric(14,2) not null default 0,
  contribution numeric(14,2) not null default 0,
  withdrawal numeric(14,2) not null default 0,
  closing_value numeric(14,2) not null default 0,
  interest numeric(14,2) not null default 0,
  dividend numeric(14,2) not null default 0,
  gain_loss numeric(14,2) not null default 0,
  monthly_growth numeric(14,2) generated always as (closing_value - opening_value) stored,
  cash_flow numeric(14,2) generated always as (contribution - withdrawal) stored,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, universal_account_id, snapshot_year, snapshot_month)
);

alter table public.universal_accounts enable row level security;
alter table public.universal_account_monthly_snapshots enable row level security;

drop policy if exists universal_accounts_select_own on public.universal_accounts;
create policy universal_accounts_select_own on public.universal_accounts
  for select using (auth.uid() = user_id);

drop policy if exists universal_accounts_insert_own on public.universal_accounts;
create policy universal_accounts_insert_own on public.universal_accounts
  for insert with check (auth.uid() = user_id);

drop policy if exists universal_accounts_update_own on public.universal_accounts;
create policy universal_accounts_update_own on public.universal_accounts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists universal_accounts_delete_own on public.universal_accounts;
create policy universal_accounts_delete_own on public.universal_accounts
  for delete using (auth.uid() = user_id);

drop policy if exists universal_account_monthly_snapshots_select_own on public.universal_account_monthly_snapshots;
create policy universal_account_monthly_snapshots_select_own on public.universal_account_monthly_snapshots
  for select using (auth.uid() = user_id);

drop policy if exists universal_account_monthly_snapshots_insert_own on public.universal_account_monthly_snapshots;
create policy universal_account_monthly_snapshots_insert_own on public.universal_account_monthly_snapshots
  for insert with check (auth.uid() = user_id);

drop policy if exists universal_account_monthly_snapshots_update_own on public.universal_account_monthly_snapshots;
create policy universal_account_monthly_snapshots_update_own on public.universal_account_monthly_snapshots
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists universal_account_monthly_snapshots_delete_own on public.universal_account_monthly_snapshots;
create policy universal_account_monthly_snapshots_delete_own on public.universal_account_monthly_snapshots
  for delete using (auth.uid() = user_id);

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists universal_accounts_set_updated_at on public.universal_accounts;
create trigger universal_accounts_set_updated_at
before update on public.universal_accounts
for each row
execute function public.handle_updated_at();

drop trigger if exists universal_account_monthly_snapshots_set_updated_at on public.universal_account_monthly_snapshots;
create trigger universal_account_monthly_snapshots_set_updated_at
before update on public.universal_account_monthly_snapshots
for each row
execute function public.handle_updated_at();

-- Backfill from existing tables to preserve data without mutating source tables.
do $$
declare
  source_exists boolean;
begin
  source_exists := to_regclass('public.accounts') is not null;
  if source_exists then
    insert into public.universal_accounts (
      user_id,
      name,
      institution,
      account_type,
      owner,
      opening_value,
      current_value,
      currency,
      notes,
      created_at,
      updated_at
    )
    select
      a.user_id,
      a.name,
      a.institution,
      case a.category
        when 'Bank Account' then 'Savings Account'
        when 'Investment' then 'Mutual Fund'
        when 'Retirement' then 'NPS'
        when 'Fixed Income' then 'Fixed Deposit'
        when 'Real Estate' then 'Real Estate'
        when 'Vehicle' then 'Vehicle'
        when 'Precious Metals' then 'Gold'
        when 'Liability' then 'Loan'
        when 'Insurance' then 'Insurance'
        when 'Credit Card' then 'Credit Card'
        else 'Cash'
      end,
      a.owner,
      coalesce(a.current_value, 0),
      coalesce(a.current_value, 0),
      coalesce(a.currency, 'USD'),
      a.notes,
      a.created_at,
      a.updated_at
    from public.accounts a
    where not exists (
      select 1
      from public.universal_accounts u
      where u.user_id = a.user_id
        and u.name = a.name
        and coalesce(u.institution, '') = coalesce(a.institution, '')
    );
  end if;

  source_exists := to_regclass('public.bank_accounts') is not null;
  if source_exists then
    insert into public.universal_accounts (
      user_id,
      name,
      institution,
      account_type,
      owner,
      joint_owner,
      nominee,
      opening_value,
      current_value,
      currency,
      interest_rate,
      notes,
      created_at,
      updated_at
    )
    select
      b.user_id,
      b.account_name,
      b.bank,
      case b.account_type
        when 'Savings' then 'Savings Account'
        when 'Salary' then 'Salary Account'
        when 'Current' then 'Current Account'
        when 'Cash' then 'Cash'
        else 'Wallet'
      end,
      b.owner,
      b.joint_holder,
      b.nominee,
      coalesce(b.opening_balance, 0),
      coalesce(b.current_balance, 0),
      coalesce(b.currency, 'USD'),
      b.interest_rate,
      b.notes,
      b.created_at,
      b.updated_at
    from public.bank_accounts b
    where not exists (
      select 1
      from public.universal_accounts u
      where u.user_id = b.user_id
        and u.name = b.account_name
        and coalesce(u.institution, '') = coalesce(b.bank, '')
    );
  end if;

  source_exists := to_regclass('public.assets') is not null;
  if source_exists then
    insert into public.universal_accounts (
      user_id,
      name,
      institution,
      account_type,
      owner,
      opening_value,
      current_value,
      currency,
      purchase_date,
      notes,
      created_at,
      updated_at
    )
    select
      s.user_id,
      s.asset_name,
      s.institution,
      case s.asset_type
        when 'cash' then 'Cash'
        when 'checking' then 'Savings Account'
        when 'savings' then 'Savings Account'
        when 'investment' then 'Mutual Fund'
        when 'real_estate' then 'Real Estate'
        when 'vehicle' then 'Vehicle'
        else 'Cash'
      end,
      s.owner,
      coalesce(s.purchase_value, s.current_value, 0),
      coalesce(s.current_value, 0),
      'USD',
      s.purchase_date,
      s.notes,
      s.created_at,
      s.updated_at
    from public.assets s
    where not exists (
      select 1
      from public.universal_accounts u
      where u.user_id = s.user_id
        and u.name = s.asset_name
        and coalesce(u.institution, '') = coalesce(s.institution, '')
    );
  end if;

  source_exists := to_regclass('public.investments') is not null;
  if source_exists then
    insert into public.universal_accounts (
      user_id,
      name,
      institution,
      account_type,
      opening_value,
      current_value,
      currency,
      purchase_date,
      notes,
      created_at,
      updated_at
    )
    select
      i.user_id,
      i.investment_name,
      coalesce(i.amc, i.sector),
      case i.category
        when 'Mutual Funds' then 'Mutual Fund'
        when 'Stocks' then 'Stock Portfolio'
        when 'ETFs' then 'Bonds'
        when 'Bonds' then 'Bonds'
        when 'Fixed Deposits' then 'Fixed Deposit'
        when 'EPF' then 'EPF'
        when 'PPF' then 'PPF'
        when 'NPS' then 'NPS'
        when 'Gold' then 'Gold'
        when 'Silver' then 'Silver'
        else 'Mutual Fund'
      end,
      coalesce(i.cost_basis, 0),
      coalesce(i.units, 0) * coalesce(i.nav_price, 0),
      'USD',
      i.purchase_date,
      i.notes,
      i.created_at,
      i.updated_at
    from public.investments i
    where not exists (
      select 1
      from public.universal_accounts u
      where u.user_id = i.user_id
        and u.name = i.investment_name
        and coalesce(u.institution, '') = coalesce(coalesce(i.amc, i.sector), '')
    );
  end if;

  source_exists := to_regclass('public.liabilities') is not null;
  if source_exists then
    insert into public.universal_accounts (
      user_id,
      name,
      institution,
      account_type,
      owner,
      opening_value,
      current_value,
      currency,
      interest_rate,
      purchase_date,
      maturity_date,
      notes,
      created_at,
      updated_at
    )
    select
      l.user_id,
      l.account_name,
      l.lender,
      case
        when l.liability_type = 'Credit Card' then 'Credit Card'
        else 'Loan'
      end,
      null,
      coalesce(l.original_amount, l.outstanding_amount, 0),
      coalesce(l.outstanding_amount, 0),
      'USD',
      l.interest_rate,
      l.start_date,
      l.end_date,
      l.notes,
      l.created_at,
      l.updated_at
    from public.liabilities l
    where not exists (
      select 1
      from public.universal_accounts u
      where u.user_id = l.user_id
        and u.name = l.account_name
        and coalesce(u.institution, '') = coalesce(l.lender, '')
    );
  end if;
end;
$$;
