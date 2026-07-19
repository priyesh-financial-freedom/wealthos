create table if not exists public.ppf_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  owner text not null,
  institution text not null,
  current_balance numeric(14,2) not null default 0,
  account_number text,
  opening_date date,
  interest_rate numeric(7,3),
  nominee text,
  notes text,
  contribution_frequency text not null check (contribution_frequency in ('Monthly', 'Quarterly', 'Annual', 'One-time')),
  contribution_amount numeric(14,2) not null default 0,
  contribution_day integer check (contribution_day between 1 and 31),
  contribution_month text check (contribution_month in ('January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December')),
  maturity_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (contribution_frequency = 'Annual' and contribution_month is not null)
    or (contribution_frequency <> 'Annual')
  )
);

create table if not exists public.epf_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  owner text not null,
  institution text not null,
  current_balance numeric(14,2) not null default 0,
  account_number text,
  opening_date date,
  interest_rate numeric(7,3),
  nominee text,
  notes text,
  contribution_frequency text not null check (contribution_frequency in ('Monthly', 'Quarterly', 'Annual', 'One-time')),
  contribution_amount numeric(14,2) not null default 0,
  contribution_day integer check (contribution_day between 1 and 31),
  contribution_month text check (contribution_month in ('January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December')),
  employer text,
  uan text,
  employee_contribution numeric(14,2),
  employer_contribution numeric(14,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (contribution_frequency = 'Annual' and contribution_month is not null)
    or (contribution_frequency <> 'Annual')
  )
);

create table if not exists public.nps_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  owner text not null,
  institution text not null,
  current_balance numeric(14,2) not null default 0,
  account_number text,
  opening_date date,
  interest_rate numeric(7,3),
  nominee text,
  notes text,
  contribution_frequency text not null check (contribution_frequency in ('Monthly', 'Quarterly', 'Annual', 'One-time')),
  contribution_amount numeric(14,2) not null default 0,
  contribution_day integer check (contribution_day between 1 and 31),
  contribution_month text check (contribution_month in ('January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December')),
  pran text,
  pop text,
  equity_percent numeric(5,2),
  corporate_debt_percent numeric(5,2),
  government_securities_percent numeric(5,2),
  alternative_assets_percent numeric(5,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (contribution_frequency = 'Annual' and contribution_month is not null)
    or (contribution_frequency <> 'Annual')
  )
);

alter table public.ppf_accounts enable row level security;
alter table public.epf_accounts enable row level security;
alter table public.nps_accounts enable row level security;

drop policy if exists ppf_accounts_select_own on public.ppf_accounts;
create policy ppf_accounts_select_own on public.ppf_accounts
  for select using (auth.uid() = user_id);

drop policy if exists ppf_accounts_insert_own on public.ppf_accounts;
create policy ppf_accounts_insert_own on public.ppf_accounts
  for insert with check (auth.uid() = user_id);

drop policy if exists ppf_accounts_update_own on public.ppf_accounts;
create policy ppf_accounts_update_own on public.ppf_accounts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists ppf_accounts_delete_own on public.ppf_accounts;
create policy ppf_accounts_delete_own on public.ppf_accounts
  for delete using (auth.uid() = user_id);

drop policy if exists epf_accounts_select_own on public.epf_accounts;
create policy epf_accounts_select_own on public.epf_accounts
  for select using (auth.uid() = user_id);

drop policy if exists epf_accounts_insert_own on public.epf_accounts;
create policy epf_accounts_insert_own on public.epf_accounts
  for insert with check (auth.uid() = user_id);

drop policy if exists epf_accounts_update_own on public.epf_accounts;
create policy epf_accounts_update_own on public.epf_accounts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists epf_accounts_delete_own on public.epf_accounts;
create policy epf_accounts_delete_own on public.epf_accounts
  for delete using (auth.uid() = user_id);

drop policy if exists nps_accounts_select_own on public.nps_accounts;
create policy nps_accounts_select_own on public.nps_accounts
  for select using (auth.uid() = user_id);

drop policy if exists nps_accounts_insert_own on public.nps_accounts;
create policy nps_accounts_insert_own on public.nps_accounts
  for insert with check (auth.uid() = user_id);

drop policy if exists nps_accounts_update_own on public.nps_accounts;
create policy nps_accounts_update_own on public.nps_accounts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists nps_accounts_delete_own on public.nps_accounts;
create policy nps_accounts_delete_own on public.nps_accounts
  for delete using (auth.uid() = user_id);

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists ppf_accounts_set_updated_at on public.ppf_accounts;
create trigger ppf_accounts_set_updated_at
before update on public.ppf_accounts
for each row
execute function public.handle_updated_at();

drop trigger if exists epf_accounts_set_updated_at on public.epf_accounts;
create trigger epf_accounts_set_updated_at
before update on public.epf_accounts
for each row
execute function public.handle_updated_at();

drop trigger if exists nps_accounts_set_updated_at on public.nps_accounts;
create trigger nps_accounts_set_updated_at
before update on public.nps_accounts
for each row
execute function public.handle_updated_at();

insert into public.ppf_accounts (
  user_id,
  owner,
  institution,
  current_balance,
  account_number,
  opening_date,
  interest_rate,
  nominee,
  notes,
  contribution_frequency,
  contribution_amount,
  contribution_day,
  contribution_month,
  created_at,
  updated_at
)
select
  user_id,
  holder_name,
  institution,
  current_value,
  account_number,
  opening_date,
  interest_rate,
  nominee,
  notes,
  case
    when coalesce(monthly_contribution, 0) > 0 then 'Monthly'
    when coalesce(annual_contribution, 0) > 0 then 'Annual'
    else 'One-time'
  end,
  case
    when coalesce(monthly_contribution, 0) > 0 then monthly_contribution
    else coalesce(annual_contribution, 0)
  end,
  null,
  null,
  created_at,
  updated_at
from public.retirement_accounts
where account_type = 'PPF'
  and not exists (
    select 1
    from public.ppf_accounts ppf
    where ppf.user_id = retirement_accounts.user_id
      and ppf.institution = retirement_accounts.institution
      and coalesce(ppf.account_number, '') = coalesce(retirement_accounts.account_number, '')
  );

insert into public.epf_accounts (
  user_id,
  owner,
  institution,
  current_balance,
  account_number,
  opening_date,
  interest_rate,
  nominee,
  notes,
  contribution_frequency,
  contribution_amount,
  contribution_day,
  contribution_month,
  created_at,
  updated_at
)
select
  user_id,
  holder_name,
  institution,
  current_value,
  account_number,
  opening_date,
  interest_rate,
  nominee,
  notes,
  case
    when coalesce(monthly_contribution, 0) > 0 then 'Monthly'
    when coalesce(annual_contribution, 0) > 0 then 'Annual'
    else 'One-time'
  end,
  case
    when coalesce(monthly_contribution, 0) > 0 then monthly_contribution
    else coalesce(annual_contribution, 0)
  end,
  null,
  null,
  created_at,
  updated_at
from public.retirement_accounts
where account_type = 'EPF'
  and not exists (
    select 1
    from public.epf_accounts epf
    where epf.user_id = retirement_accounts.user_id
      and epf.institution = retirement_accounts.institution
      and coalesce(epf.account_number, '') = coalesce(retirement_accounts.account_number, '')
  );

insert into public.nps_accounts (
  user_id,
  owner,
  institution,
  current_balance,
  account_number,
  opening_date,
  interest_rate,
  nominee,
  notes,
  contribution_frequency,
  contribution_amount,
  contribution_day,
  contribution_month,
  created_at,
  updated_at
)
select
  user_id,
  holder_name,
  institution,
  current_value,
  account_number,
  opening_date,
  interest_rate,
  nominee,
  notes,
  case
    when coalesce(monthly_contribution, 0) > 0 then 'Monthly'
    when coalesce(annual_contribution, 0) > 0 then 'Annual'
    else 'One-time'
  end,
  case
    when coalesce(monthly_contribution, 0) > 0 then monthly_contribution
    else coalesce(annual_contribution, 0)
  end,
  null,
  null,
  created_at,
  updated_at
from public.retirement_accounts
where account_type = 'NPS'
  and not exists (
    select 1
    from public.nps_accounts nps
    where nps.user_id = retirement_accounts.user_id
      and nps.institution = retirement_accounts.institution
      and coalesce(nps.account_number, '') = coalesce(retirement_accounts.account_number, '')
  );
