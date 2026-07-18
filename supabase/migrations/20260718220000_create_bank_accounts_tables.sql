create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_type text not null check (account_type in ('Savings', 'Salary', 'Current', 'Cash', 'Wallet')),
  bank text not null,
  account_name text not null,
  nickname text,
  account_number text not null,
  ifsc text,
  currency text not null default 'USD',
  current_balance numeric(14,2) not null default 0,
  opening_balance numeric(14,2) not null default 0,
  interest_rate numeric(7,3) not null default 0,
  owner text,
  nominee text,
  joint_holder text,
  notes text,
  documents_placeholder text,
  status text not null default 'active' check (status in ('active', 'inactive', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bank_account_monthly_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bank_account_id uuid not null references public.bank_accounts(id) on delete cascade,
  snapshot_month integer not null check (snapshot_month between 1 and 12),
  snapshot_year integer not null check (snapshot_year >= 2000),
  opening_balance numeric(14,2) not null default 0,
  deposits numeric(14,2) not null default 0,
  withdrawals numeric(14,2) not null default 0,
  closing_balance numeric(14,2) not null default 0,
  interest_rate numeric(7,3) not null default 0,
  monthly_change numeric(14,2) generated always as (closing_balance - opening_balance) stored,
  cash_flow numeric(14,2) generated always as (deposits - withdrawals) stored,
  average_balance numeric(14,2) generated always as ((opening_balance + closing_balance) / 2) stored,
  interest_earned numeric(14,2) generated always as (((opening_balance + closing_balance) / 2) * (interest_rate / 1200)) stored,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, bank_account_id, snapshot_year, snapshot_month)
);

alter table public.bank_accounts enable row level security;
alter table public.bank_account_monthly_snapshots enable row level security;

drop policy if exists bank_accounts_select_own on public.bank_accounts;
create policy bank_accounts_select_own on public.bank_accounts
  for select using (auth.uid() = user_id);

drop policy if exists bank_accounts_insert_own on public.bank_accounts;
create policy bank_accounts_insert_own on public.bank_accounts
  for insert with check (auth.uid() = user_id);

drop policy if exists bank_accounts_update_own on public.bank_accounts;
create policy bank_accounts_update_own on public.bank_accounts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists bank_accounts_delete_own on public.bank_accounts;
create policy bank_accounts_delete_own on public.bank_accounts
  for delete using (auth.uid() = user_id);

drop policy if exists bank_account_monthly_snapshots_select_own on public.bank_account_monthly_snapshots;
create policy bank_account_monthly_snapshots_select_own on public.bank_account_monthly_snapshots
  for select using (auth.uid() = user_id);

drop policy if exists bank_account_monthly_snapshots_insert_own on public.bank_account_monthly_snapshots;
create policy bank_account_monthly_snapshots_insert_own on public.bank_account_monthly_snapshots
  for insert with check (auth.uid() = user_id);

drop policy if exists bank_account_monthly_snapshots_update_own on public.bank_account_monthly_snapshots;
create policy bank_account_monthly_snapshots_update_own on public.bank_account_monthly_snapshots
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists bank_account_monthly_snapshots_delete_own on public.bank_account_monthly_snapshots;
create policy bank_account_monthly_snapshots_delete_own on public.bank_account_monthly_snapshots
  for delete using (auth.uid() = user_id);

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger bank_accounts_set_updated_at
before update on public.bank_accounts
for each row
execute function public.handle_updated_at();

create trigger bank_account_monthly_snapshots_set_updated_at
before update on public.bank_account_monthly_snapshots
for each row
execute function public.handle_updated_at();
