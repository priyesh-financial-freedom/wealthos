create table if not exists public.retirement_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_type text not null check (account_type in ('EPF', 'PPF', 'NPS')),
  institution text not null,
  account_number text not null,
  holder_name text not null,
  opening_date date,
  current_value numeric(14,2) not null default 0,
  monthly_contribution numeric(14,2) not null default 0,
  annual_contribution numeric(14,2) not null default 0,
  interest_rate numeric(7,3) not null default 0,
  nominee text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, account_type, institution, account_number)
);

create table if not exists public.monthly_retirement_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  retirement_account_id uuid not null references public.retirement_accounts(id) on delete cascade,
  snapshot_month integer not null check (snapshot_month between 1 and 12),
  snapshot_year integer not null check (snapshot_year >= 2000),
  opening_balance numeric(14,2) not null default 0,
  contribution numeric(14,2) not null default 0,
  interest numeric(14,2) not null default 0,
  closing_balance numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, retirement_account_id, snapshot_year, snapshot_month)
);

alter table public.retirement_accounts enable row level security;
alter table public.monthly_retirement_snapshots enable row level security;

drop policy if exists retirement_accounts_select_own on public.retirement_accounts;
create policy retirement_accounts_select_own on public.retirement_accounts
  for select using (auth.uid() = user_id);

drop policy if exists retirement_accounts_insert_own on public.retirement_accounts;
create policy retirement_accounts_insert_own on public.retirement_accounts
  for insert with check (auth.uid() = user_id);

drop policy if exists retirement_accounts_update_own on public.retirement_accounts;
create policy retirement_accounts_update_own on public.retirement_accounts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists retirement_accounts_delete_own on public.retirement_accounts;
create policy retirement_accounts_delete_own on public.retirement_accounts
  for delete using (auth.uid() = user_id);

drop policy if exists monthly_retirement_snapshots_select_own on public.monthly_retirement_snapshots;
create policy monthly_retirement_snapshots_select_own on public.monthly_retirement_snapshots
  for select using (auth.uid() = user_id);

drop policy if exists monthly_retirement_snapshots_insert_own on public.monthly_retirement_snapshots;
create policy monthly_retirement_snapshots_insert_own on public.monthly_retirement_snapshots
  for insert with check (auth.uid() = user_id);

drop policy if exists monthly_retirement_snapshots_update_own on public.monthly_retirement_snapshots;
create policy monthly_retirement_snapshots_update_own on public.monthly_retirement_snapshots
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists monthly_retirement_snapshots_delete_own on public.monthly_retirement_snapshots;
create policy monthly_retirement_snapshots_delete_own on public.monthly_retirement_snapshots
  for delete using (auth.uid() = user_id);

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists retirement_accounts_set_updated_at on public.retirement_accounts;
create trigger retirement_accounts_set_updated_at
before update on public.retirement_accounts
for each row
execute function public.handle_updated_at();

drop trigger if exists monthly_retirement_snapshots_set_updated_at on public.monthly_retirement_snapshots;
create trigger monthly_retirement_snapshots_set_updated_at
before update on public.monthly_retirement_snapshots
for each row
execute function public.handle_updated_at();

create or replace function public.capture_retirement_monthly_snapshots(
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

  insert into public.monthly_retirement_snapshots (
    user_id,
    retirement_account_id,
    snapshot_month,
    snapshot_year,
    opening_balance,
    contribution,
    interest,
    closing_balance
  )
  select
    v_user_id,
    account.id,
    p_snapshot_month,
    p_snapshot_year,
    coalesce(previous_snapshot.closing_balance, greatest(coalesce(account.current_value, 0) - coalesce(account.monthly_contribution, 0) - coalesce(estimated_interest.value, 0), 0)),
    coalesce(account.monthly_contribution, 0),
    case
      when previous_snapshot.id is not null then greatest(
        coalesce(account.current_value, 0)
          - previous_snapshot.closing_balance
          - coalesce(account.monthly_contribution, 0),
        0
      )
      else coalesce(estimated_interest.value, 0)
    end,
    coalesce(account.current_value, 0)
  from public.retirement_accounts account
  left join lateral (
    select snapshot.*
    from public.monthly_retirement_snapshots snapshot
    where snapshot.retirement_account_id = account.id
      and snapshot.user_id = v_user_id
      and (snapshot.snapshot_year < p_snapshot_year or (snapshot.snapshot_year = p_snapshot_year and snapshot.snapshot_month < p_snapshot_month))
    order by snapshot.snapshot_year desc, snapshot.snapshot_month desc, snapshot.created_at desc
    limit 1
  ) previous_snapshot on true
  left join lateral (
    select round((greatest(coalesce(account.current_value, 0) - coalesce(account.monthly_contribution, 0), 0) * coalesce(account.interest_rate, 0) / 1200.0)::numeric, 2) as value
  ) estimated_interest on true
  where account.user_id = v_user_id
    and not exists (
      select 1
      from public.monthly_retirement_snapshots existing
      where existing.user_id = v_user_id
        and existing.retirement_account_id = account.id
        and existing.snapshot_month = p_snapshot_month
        and existing.snapshot_year = p_snapshot_year
    );
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

  select coalesce(sum(current_value), 0)
    into v_assets_total
  from public.monthly_asset_snapshots
  where snapshot_id = v_snapshot.id;

  if to_regclass('public.investments') is not null then
    select coalesce(sum(current_value), 0)
      into v_investments_total
    from public.monthly_investment_snapshots
    where snapshot_id = v_snapshot.id;
  else
    v_investments_total := 0;
  end if;

  select coalesce(sum(outstanding_balance), 0)
    into v_liabilities_total
  from public.monthly_liability_snapshots
  where snapshot_id = v_snapshot.id;

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
  set assets_total = v_assets_total,
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