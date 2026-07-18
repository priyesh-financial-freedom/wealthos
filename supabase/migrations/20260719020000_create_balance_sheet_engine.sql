alter table public.monthly_snapshots add column if not exists cash_and_bank_total numeric(14,2) not null default 0;
alter table public.monthly_snapshots add column if not exists retirement_total numeric(14,2) not null default 0;
alter table public.monthly_snapshots add column if not exists fixed_deposits_total numeric(14,2) not null default 0;
alter table public.monthly_snapshots add column if not exists gold_silver_total numeric(14,2) not null default 0;
alter table public.monthly_snapshots add column if not exists real_estate_total numeric(14,2) not null default 0;
alter table public.monthly_snapshots add column if not exists vehicles_total numeric(14,2) not null default 0;
alter table public.monthly_snapshots add column if not exists other_assets_total numeric(14,2) not null default 0;
alter table public.monthly_snapshots add column if not exists home_loan_total numeric(14,2) not null default 0;
alter table public.monthly_snapshots add column if not exists car_loan_total numeric(14,2) not null default 0;
alter table public.monthly_snapshots add column if not exists credit_cards_total numeric(14,2) not null default 0;
alter table public.monthly_snapshots add column if not exists personal_loan_total numeric(14,2) not null default 0;
alter table public.monthly_snapshots add column if not exists other_liabilities_total numeric(14,2) not null default 0;

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

  select
    coalesce((
      select sum(current_value)
      from public.assets
      where user_id = v_user_id
        and asset_type in ('cash', 'checking', 'savings')
    ), 0)
    + coalesce((
      select sum(current_balance)
      from public.bank_accounts
      where user_id = v_user_id
        and status <> 'closed'
    ), 0)
    into v_cash_and_bank_total;

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