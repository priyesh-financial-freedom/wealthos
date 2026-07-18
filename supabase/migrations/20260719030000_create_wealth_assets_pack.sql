create table if not exists public.fixed_deposit_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deposit_type text not null check (deposit_type in ('FD', 'RD')),
  institution text not null,
  branch text,
  account_number text not null,
  holder text not null,
  principal numeric(14,2) not null default 0,
  interest_rate numeric(7,3) not null default 0,
  compounding_frequency text not null default 'quarterly' check (compounding_frequency in ('monthly', 'quarterly', 'half-yearly', 'yearly')),
  current_value numeric(14,2) not null default 0,
  opening_date date,
  maturity_date date,
  auto_renew boolean not null default false,
  owner text,
  nominee text,
  notes text,
  documents_placeholder text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gold_holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  holding_type text not null check (holding_type in ('Physical Gold', 'Gold ETF', 'Sovereign Gold Bond', 'Digital Gold')),
  description text not null,
  quantity numeric(14,4) not null default 0,
  unit text not null default 'g',
  purity text,
  purchase_date date,
  cost_basis numeric(14,2) not null default 0,
  current_value numeric(14,2) not null default 0,
  custodian text,
  institution text,
  owner text,
  nominee text,
  notes text,
  documents_placeholder text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.silver_holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  holding_type text not null check (holding_type in ('Physical Silver', 'Silver ETF', 'Digital Silver')),
  description text not null,
  quantity numeric(14,4) not null default 0,
  unit text not null default 'g',
  purity text,
  purchase_date date,
  cost_basis numeric(14,2) not null default 0,
  current_value numeric(14,2) not null default 0,
  custodian text,
  institution text,
  owner text,
  nominee text,
  notes text,
  documents_placeholder text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monthly_fixed_deposit_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.monthly_snapshots(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  fixed_deposit_id uuid not null references public.fixed_deposit_accounts(id) on delete cascade,
  snapshot_month integer not null check (snapshot_month between 1 and 12),
  snapshot_year integer not null check (snapshot_year >= 2000),
  opening_value numeric(14,2) not null default 0,
  closing_value numeric(14,2) not null default 0,
  interest_accrued numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, fixed_deposit_id, snapshot_year, snapshot_month)
);

create table if not exists public.monthly_gold_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.monthly_snapshots(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  gold_holding_id uuid not null references public.gold_holdings(id) on delete cascade,
  snapshot_month integer not null check (snapshot_month between 1 and 12),
  snapshot_year integer not null check (snapshot_year >= 2000),
  opening_value numeric(14,2) not null default 0,
  closing_value numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, gold_holding_id, snapshot_year, snapshot_month)
);

create table if not exists public.monthly_silver_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.monthly_snapshots(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  silver_holding_id uuid not null references public.silver_holdings(id) on delete cascade,
  snapshot_month integer not null check (snapshot_month between 1 and 12),
  snapshot_year integer not null check (snapshot_year >= 2000),
  opening_value numeric(14,2) not null default 0,
  closing_value numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, silver_holding_id, snapshot_year, snapshot_month)
);

alter table public.fixed_deposit_accounts enable row level security;
alter table public.gold_holdings enable row level security;
alter table public.silver_holdings enable row level security;
alter table public.monthly_fixed_deposit_snapshots enable row level security;
alter table public.monthly_gold_snapshots enable row level security;
alter table public.monthly_silver_snapshots enable row level security;

drop policy if exists fixed_deposit_accounts_select_own on public.fixed_deposit_accounts;
create policy fixed_deposit_accounts_select_own on public.fixed_deposit_accounts for select using (auth.uid() = user_id);
drop policy if exists fixed_deposit_accounts_insert_own on public.fixed_deposit_accounts;
create policy fixed_deposit_accounts_insert_own on public.fixed_deposit_accounts for insert with check (auth.uid() = user_id);
drop policy if exists fixed_deposit_accounts_update_own on public.fixed_deposit_accounts;
create policy fixed_deposit_accounts_update_own on public.fixed_deposit_accounts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists fixed_deposit_accounts_delete_own on public.fixed_deposit_accounts;
create policy fixed_deposit_accounts_delete_own on public.fixed_deposit_accounts for delete using (auth.uid() = user_id);

drop policy if exists gold_holdings_select_own on public.gold_holdings;
create policy gold_holdings_select_own on public.gold_holdings for select using (auth.uid() = user_id);
drop policy if exists gold_holdings_insert_own on public.gold_holdings;
create policy gold_holdings_insert_own on public.gold_holdings for insert with check (auth.uid() = user_id);
drop policy if exists gold_holdings_update_own on public.gold_holdings;
create policy gold_holdings_update_own on public.gold_holdings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists gold_holdings_delete_own on public.gold_holdings;
create policy gold_holdings_delete_own on public.gold_holdings for delete using (auth.uid() = user_id);

drop policy if exists silver_holdings_select_own on public.silver_holdings;
create policy silver_holdings_select_own on public.silver_holdings for select using (auth.uid() = user_id);
drop policy if exists silver_holdings_insert_own on public.silver_holdings;
create policy silver_holdings_insert_own on public.silver_holdings for insert with check (auth.uid() = user_id);
drop policy if exists silver_holdings_update_own on public.silver_holdings;
create policy silver_holdings_update_own on public.silver_holdings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists silver_holdings_delete_own on public.silver_holdings;
create policy silver_holdings_delete_own on public.silver_holdings for delete using (auth.uid() = user_id);

drop policy if exists monthly_fixed_deposit_snapshots_select_own on public.monthly_fixed_deposit_snapshots;
create policy monthly_fixed_deposit_snapshots_select_own on public.monthly_fixed_deposit_snapshots for select using (auth.uid() = user_id);
drop policy if exists monthly_fixed_deposit_snapshots_insert_own on public.monthly_fixed_deposit_snapshots;
create policy monthly_fixed_deposit_snapshots_insert_own on public.monthly_fixed_deposit_snapshots for insert with check (auth.uid() = user_id);
drop policy if exists monthly_fixed_deposit_snapshots_update_own on public.monthly_fixed_deposit_snapshots;
create policy monthly_fixed_deposit_snapshots_update_own on public.monthly_fixed_deposit_snapshots for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists monthly_fixed_deposit_snapshots_delete_own on public.monthly_fixed_deposit_snapshots;
create policy monthly_fixed_deposit_snapshots_delete_own on public.monthly_fixed_deposit_snapshots for delete using (auth.uid() = user_id);

drop policy if exists monthly_gold_snapshots_select_own on public.monthly_gold_snapshots;
create policy monthly_gold_snapshots_select_own on public.monthly_gold_snapshots for select using (auth.uid() = user_id);
drop policy if exists monthly_gold_snapshots_insert_own on public.monthly_gold_snapshots;
create policy monthly_gold_snapshots_insert_own on public.monthly_gold_snapshots for insert with check (auth.uid() = user_id);
drop policy if exists monthly_gold_snapshots_update_own on public.monthly_gold_snapshots;
create policy monthly_gold_snapshots_update_own on public.monthly_gold_snapshots for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists monthly_gold_snapshots_delete_own on public.monthly_gold_snapshots;
create policy monthly_gold_snapshots_delete_own on public.monthly_gold_snapshots for delete using (auth.uid() = user_id);

drop policy if exists monthly_silver_snapshots_select_own on public.monthly_silver_snapshots;
create policy monthly_silver_snapshots_select_own on public.monthly_silver_snapshots for select using (auth.uid() = user_id);
drop policy if exists monthly_silver_snapshots_insert_own on public.monthly_silver_snapshots;
create policy monthly_silver_snapshots_insert_own on public.monthly_silver_snapshots for insert with check (auth.uid() = user_id);
drop policy if exists monthly_silver_snapshots_update_own on public.monthly_silver_snapshots;
create policy monthly_silver_snapshots_update_own on public.monthly_silver_snapshots for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists monthly_silver_snapshots_delete_own on public.monthly_silver_snapshots;
create policy monthly_silver_snapshots_delete_own on public.monthly_silver_snapshots for delete using (auth.uid() = user_id);

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists fixed_deposit_accounts_set_updated_at on public.fixed_deposit_accounts;
create trigger fixed_deposit_accounts_set_updated_at before update on public.fixed_deposit_accounts for each row execute function public.handle_updated_at();
drop trigger if exists gold_holdings_set_updated_at on public.gold_holdings;
create trigger gold_holdings_set_updated_at before update on public.gold_holdings for each row execute function public.handle_updated_at();
drop trigger if exists silver_holdings_set_updated_at on public.silver_holdings;
create trigger silver_holdings_set_updated_at before update on public.silver_holdings for each row execute function public.handle_updated_at();
drop trigger if exists monthly_fixed_deposit_snapshots_set_updated_at on public.monthly_fixed_deposit_snapshots;
create trigger monthly_fixed_deposit_snapshots_set_updated_at before update on public.monthly_fixed_deposit_snapshots for each row execute function public.handle_updated_at();
drop trigger if exists monthly_gold_snapshots_set_updated_at on public.monthly_gold_snapshots;
create trigger monthly_gold_snapshots_set_updated_at before update on public.monthly_gold_snapshots for each row execute function public.handle_updated_at();
drop trigger if exists monthly_silver_snapshots_set_updated_at on public.monthly_silver_snapshots;
create trigger monthly_silver_snapshots_set_updated_at before update on public.monthly_silver_snapshots for each row execute function public.handle_updated_at();

create or replace function public.capture_wealth_assets_monthly_snapshots(
  p_snapshot_id uuid,
  p_snapshot_month integer,
  p_snapshot_year integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if to_regclass('public.fixed_deposit_accounts') is not null then
    insert into public.monthly_fixed_deposit_snapshots (
      snapshot_id,
      user_id,
      fixed_deposit_id,
      snapshot_month,
      snapshot_year,
      opening_value,
      closing_value,
      interest_accrued
    )
    select
      p_snapshot_id,
      v_user_id,
      fd.id,
      p_snapshot_month,
      p_snapshot_year,
      coalesce(prev.closing_value, fd.current_value),
      coalesce(fd.current_value, 0),
      greatest(coalesce(fd.current_value, 0) - coalesce(prev.closing_value, fd.principal, 0), 0)
    from public.fixed_deposit_accounts fd
    left join lateral (
      select snapshot.*
      from public.monthly_fixed_deposit_snapshots snapshot
      where snapshot.fixed_deposit_id = fd.id
        and snapshot.user_id = v_user_id
        and (snapshot.snapshot_year < p_snapshot_year or (snapshot.snapshot_year = p_snapshot_year and snapshot.snapshot_month < p_snapshot_month))
      order by snapshot.snapshot_year desc, snapshot.snapshot_month desc, snapshot.created_at desc
      limit 1
    ) prev on true
    where fd.user_id = v_user_id
      and not exists (
        select 1 from public.monthly_fixed_deposit_snapshots existing
        where existing.user_id = v_user_id
          and existing.fixed_deposit_id = fd.id
          and existing.snapshot_month = p_snapshot_month
          and existing.snapshot_year = p_snapshot_year
      );
  end if;

  if to_regclass('public.gold_holdings') is not null then
    insert into public.monthly_gold_snapshots (
      snapshot_id,
      user_id,
      gold_holding_id,
      snapshot_month,
      snapshot_year,
      opening_value,
      closing_value
    )
    select
      p_snapshot_id,
      v_user_id,
      g.id,
      p_snapshot_month,
      p_snapshot_year,
      coalesce(prev.closing_value, g.current_value),
      coalesce(g.current_value, 0)
    from public.gold_holdings g
    left join lateral (
      select snapshot.*
      from public.monthly_gold_snapshots snapshot
      where snapshot.gold_holding_id = g.id
        and snapshot.user_id = v_user_id
        and (snapshot.snapshot_year < p_snapshot_year or (snapshot.snapshot_year = p_snapshot_year and snapshot.snapshot_month < p_snapshot_month))
      order by snapshot.snapshot_year desc, snapshot.snapshot_month desc, snapshot.created_at desc
      limit 1
    ) prev on true
    where g.user_id = v_user_id
      and not exists (
        select 1 from public.monthly_gold_snapshots existing
        where existing.user_id = v_user_id
          and existing.gold_holding_id = g.id
          and existing.snapshot_month = p_snapshot_month
          and existing.snapshot_year = p_snapshot_year
      );
  end if;

  if to_regclass('public.silver_holdings') is not null then
    insert into public.monthly_silver_snapshots (
      snapshot_id,
      user_id,
      silver_holding_id,
      snapshot_month,
      snapshot_year,
      opening_value,
      closing_value
    )
    select
      p_snapshot_id,
      v_user_id,
      s.id,
      p_snapshot_month,
      p_snapshot_year,
      coalesce(prev.closing_value, s.current_value),
      coalesce(s.current_value, 0)
    from public.silver_holdings s
    left join lateral (
      select snapshot.*
      from public.monthly_silver_snapshots snapshot
      where snapshot.silver_holding_id = s.id
        and snapshot.user_id = v_user_id
        and (snapshot.snapshot_year < p_snapshot_year or (snapshot.snapshot_year = p_snapshot_year and snapshot.snapshot_month < p_snapshot_month))
      order by snapshot.snapshot_year desc, snapshot.snapshot_month desc, snapshot.created_at desc
      limit 1
    ) prev on true
    where s.user_id = v_user_id
      and not exists (
        select 1 from public.monthly_silver_snapshots existing
        where existing.user_id = v_user_id
          and existing.silver_holding_id = s.id
          and existing.snapshot_month = p_snapshot_month
          and existing.snapshot_year = p_snapshot_year
      );
  end if;
end;
$$;

create or replace function public.close_monthly_snapshot(p_snapshot_month integer, p_snapshot_year integer)
returns public.monthly_snapshots
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_snapshot public.monthly_snapshots;
  v_previous_month public.monthly_snapshots;
  v_previous_year public.monthly_snapshots;
  v_assets_total numeric(14,2) := 0;
  v_liabilities_total numeric(14,2) := 0;
  v_investments_total numeric(14,2) := 0;
  v_cash_and_bank_total numeric(14,2) := 0;
  v_retirement_total numeric(14,2) := 0;
  v_fixed_deposits_total numeric(14,2) := 0;
  v_gold_silver_total numeric(14,2) := 0;
  v_real_estate_total numeric(14,2) := 0;
  v_vehicles_total numeric(14,2) := 0;
  v_other_assets_total numeric(14,2) := 0;
  v_home_loan_total numeric(14,2) := 0;
  v_car_loan_total numeric(14,2) := 0;
  v_credit_cards_total numeric(14,2) := 0;
  v_personal_loan_total numeric(14,2) := 0;
  v_other_liabilities_total numeric(14,2) := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if p_snapshot_month not between 1 and 12 then
    raise exception 'Snapshot month must be between 1 and 12.';
  end if;

  if p_snapshot_year < 2000 then
    raise exception 'Snapshot year must be 2000 or later.';
  end if;

  if exists (
    select 1
    from public.monthly_snapshots
    where user_id = v_user_id
      and snapshot_month = p_snapshot_month
      and snapshot_year = p_snapshot_year
  ) then
    raise exception 'This month has already been closed.';
  end if;

  insert into public.monthly_snapshots (
    user_id,
    snapshot_month,
    snapshot_year,
    status,
    assets_total,
    liabilities_total,
    investments_total,
    net_worth,
    growth_from_previous_month,
    growth_from_previous_year
  ) values (
    v_user_id,
    p_snapshot_month,
    p_snapshot_year,
    'closed',
    0,
    0,
    0,
    0,
    0,
    0
  ) returning * into v_snapshot;

  insert into public.monthly_asset_snapshots (
    snapshot_id,
    user_id,
    snapshot_month,
    snapshot_year,
    asset_id,
    asset_type,
    asset_name,
    institution,
    current_value,
    cost_basis,
    gain_loss
  )
  select
    v_snapshot.id,
    v_user_id,
    p_snapshot_month,
    p_snapshot_year,
    asset.id,
    asset.asset_type,
    asset.asset_name,
    asset.institution,
    coalesce(asset.current_value, 0),
    coalesce(asset.purchase_value, asset.current_value, 0),
    coalesce(asset.current_value, 0) - coalesce(asset.purchase_value, asset.current_value, 0)
  from public.assets asset
  where asset.user_id = v_user_id;

  if to_regclass('public.investments') is not null then
    insert into public.monthly_investment_snapshots (
      snapshot_id,
      user_id,
      snapshot_month,
      snapshot_year,
      investment_id,
      investment_name,
      category,
      region,
      sector,
      amc,
      current_value,
      cost_basis,
      gain_loss
    )
    select
      v_snapshot.id,
      v_user_id,
      p_snapshot_month,
      p_snapshot_year,
      investment.id,
      investment.investment_name,
      investment.category,
      investment.region,
      investment.sector,
      investment.amc,
      coalesce(investment.units, 0) * coalesce(investment.nav_price, 0),
      coalesce(investment.cost_basis, 0),
      (coalesce(investment.units, 0) * coalesce(investment.nav_price, 0)) - coalesce(investment.cost_basis, 0)
    from public.investments investment
    where investment.user_id = v_user_id;
  end if;

  insert into public.monthly_liability_snapshots (
    snapshot_id,
    user_id,
    snapshot_month,
    snapshot_year,
    liability_id,
    liability_type,
    account_name,
    lender,
    status,
    current_value,
    cost_basis,
    gain_loss,
    outstanding_balance
  )
  select
    v_snapshot.id,
    v_user_id,
    p_snapshot_month,
    p_snapshot_year,
    liability.id,
    liability.liability_type,
    liability.account_name,
    liability.lender,
    liability.status,
    coalesce(liability.outstanding_amount, 0),
    coalesce(liability.original_amount, liability.outstanding_amount, 0),
    coalesce(liability.original_amount, liability.outstanding_amount, 0) - coalesce(liability.outstanding_amount, 0),
    coalesce(liability.outstanding_amount, 0)
  from public.liabilities liability
  where liability.user_id = v_user_id;

  if to_regclass('public.retirement_accounts') is not null then
    perform public.capture_retirement_monthly_snapshots(p_snapshot_month, p_snapshot_year);
  end if;

  perform public.capture_wealth_assets_monthly_snapshots(v_snapshot.id, p_snapshot_month, p_snapshot_year);

  select coalesce(sum(current_value), 0)
    into v_cash_and_bank_total
  from public.assets
  where user_id = v_user_id
    and asset_type in ('cash', 'checking', 'savings');

  if to_regclass('public.bank_accounts') is not null then
    select v_cash_and_bank_total + coalesce(sum(current_balance), 0)
      into v_cash_and_bank_total
    from public.bank_accounts
    where user_id = v_user_id
      and status <> 'closed';
  end if;

  if to_regclass('public.investments') is not null then
    select coalesce(sum(current_value), 0)
      into v_investments_total
    from public.monthly_investment_snapshots
    where snapshot_id = v_snapshot.id
      and category not in ('EPF', 'PPF', 'NPS', 'Fixed Deposits', 'Gold', 'Silver', 'Sovereign Gold Bonds');

    select coalesce(sum(current_value), 0)
      into v_retirement_total
    from public.monthly_investment_snapshots
    where snapshot_id = v_snapshot.id
      and category in ('EPF', 'PPF', 'NPS');

    select coalesce(sum(current_value), 0)
      into v_fixed_deposits_total
    from public.monthly_investment_snapshots
    where snapshot_id = v_snapshot.id
      and category = 'Fixed Deposits';

    select coalesce(sum(current_value), 0)
      into v_gold_silver_total
    from public.monthly_investment_snapshots
    where snapshot_id = v_snapshot.id
      and category in ('Gold', 'Silver', 'Sovereign Gold Bonds');
  else
    v_investments_total := 0;
    v_retirement_total := 0;
    v_fixed_deposits_total := 0;
    v_gold_silver_total := 0;
  end if;

  if to_regclass('public.fixed_deposit_accounts') is not null then
    select v_fixed_deposits_total + coalesce(sum(current_value), 0)
      into v_fixed_deposits_total
    from public.fixed_deposit_accounts
    where user_id = v_user_id;
  end if;

  if to_regclass('public.gold_holdings') is not null then
    select v_gold_silver_total + coalesce(sum(current_value), 0)
      into v_gold_silver_total
    from public.gold_holdings
    where user_id = v_user_id;
  end if;

  if to_regclass('public.silver_holdings') is not null then
    select v_gold_silver_total + coalesce(sum(current_value), 0)
      into v_gold_silver_total
    from public.silver_holdings
    where user_id = v_user_id;
  end if;

  if to_regclass('public.retirement_accounts') is not null then
    select v_retirement_total + coalesce(sum(current_value), 0)
      into v_retirement_total
    from public.retirement_accounts
    where user_id = v_user_id;
  end if;

  select coalesce(sum(current_value), 0)
    into v_real_estate_total
  from public.monthly_asset_snapshots
  where snapshot_id = v_snapshot.id
    and asset_type = 'real_estate';

  select coalesce(sum(current_value), 0)
    into v_vehicles_total
  from public.monthly_asset_snapshots
  where snapshot_id = v_snapshot.id
    and asset_type = 'vehicle';

  select coalesce(sum(current_value), 0)
    into v_other_assets_total
  from public.monthly_asset_snapshots
  where snapshot_id = v_snapshot.id
    and asset_type in ('business', 'other');

  select v_investments_total + coalesce(sum(current_value), 0)
    into v_investments_total
  from public.monthly_asset_snapshots
  where snapshot_id = v_snapshot.id
    and asset_type = 'investment';

  select coalesce(sum(outstanding_balance), 0)
    into v_home_loan_total
  from public.monthly_liability_snapshots
  where snapshot_id = v_snapshot.id
    and liability_type = 'Home Loan';

  select coalesce(sum(outstanding_balance), 0)
    into v_car_loan_total
  from public.monthly_liability_snapshots
  where snapshot_id = v_snapshot.id
    and liability_type = 'Car Loan';

  select coalesce(sum(outstanding_balance), 0)
    into v_credit_cards_total
  from public.monthly_liability_snapshots
  where snapshot_id = v_snapshot.id
    and liability_type = 'Credit Card';

  select coalesce(sum(outstanding_balance), 0)
    into v_personal_loan_total
  from public.monthly_liability_snapshots
  where snapshot_id = v_snapshot.id
    and liability_type = 'Personal Loan';

  select coalesce(sum(outstanding_balance), 0)
    into v_other_liabilities_total
  from public.monthly_liability_snapshots
  where snapshot_id = v_snapshot.id
    and liability_type not in ('Home Loan', 'Car Loan', 'Credit Card', 'Personal Loan');

  v_assets_total := v_cash_and_bank_total + v_real_estate_total + v_vehicles_total + v_other_assets_total;
  v_investments_total := v_investments_total + v_retirement_total + v_fixed_deposits_total + v_gold_silver_total;
  v_liabilities_total := v_home_loan_total + v_car_loan_total + v_credit_cards_total + v_personal_loan_total + v_other_liabilities_total;

  select *
    into v_previous_month
  from public.monthly_snapshots
  where user_id = v_user_id
    and (snapshot_year < p_snapshot_year or (snapshot_year = p_snapshot_year and snapshot_month < p_snapshot_month))
  order by snapshot_year desc, snapshot_month desc
  limit 1;

  select *
    into v_previous_year
  from public.monthly_snapshots
  where user_id = v_user_id
    and snapshot_year = p_snapshot_year - 1
    and snapshot_month = p_snapshot_month
  order by snapshot_year desc, snapshot_month desc
  limit 1;

  update public.monthly_snapshots
  set cash_and_bank_total = v_cash_and_bank_total,
      retirement_total = v_retirement_total,
      fixed_deposits_total = v_fixed_deposits_total,
      gold_silver_total = v_gold_silver_total,
      real_estate_total = v_real_estate_total,
      vehicles_total = v_vehicles_total,
      other_assets_total = v_other_assets_total,
      home_loan_total = v_home_loan_total,
      car_loan_total = v_car_loan_total,
      credit_cards_total = v_credit_cards_total,
      personal_loan_total = v_personal_loan_total,
      other_liabilities_total = v_other_liabilities_total,
      assets_total = v_assets_total,
      liabilities_total = v_liabilities_total,
      investments_total = v_investments_total,
      net_worth = (v_assets_total + v_investments_total) - v_liabilities_total,
      growth_from_previous_month = case
        when v_previous_month.id is null then 0
        else ((v_assets_total + v_investments_total) - v_liabilities_total) - v_previous_month.net_worth
      end,
      growth_from_previous_year = case
        when v_previous_year.id is null then 0
        else ((v_assets_total + v_investments_total) - v_liabilities_total) - v_previous_year.net_worth
      end
  where id = v_snapshot.id
  returning * into v_snapshot;

  return v_snapshot;
exception
  when unique_violation then
    raise exception 'This month has already been closed.';
end;
$$;
